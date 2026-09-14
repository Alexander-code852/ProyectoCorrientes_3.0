"""
backend/importador_lugares/extraer_overpass.py

Puebla la base SQLite de lugares turísticos de Ruta Correntina consultando
la API de Overpass (OpenStreetMap) -datos públicos, libres y sin necesidad
de API key. Pensado para correrse manualmente de vez en cuando (no es un
endpoint HTTP ni corre dentro de la app), ej.:

    python -m backend.importador_lugares.extraer_overpass

Qué hace, en orden:
  1. Arma una consulta Overpass QL (BBOX_CORRIENTES) pidiendo restaurantes,
     cafeterías, museos, plazas, playas, hoteles y monumentos.
  2. Le pega a la API pública de Overpass (con reintento a un mirror si el
     servidor principal está ocupado -es un recurso compartido y gratuito,
     puede tardar o devolver 504 en horas pico).
  3. Parsea cada elemento devuelto, descarta los que no sirven (sin nombre,
     sin categoría reconocida) y arma un dict limpio por lugar.
  4. Dedupea por nombre+cercanía: es común que OSM mapee el mismo lugar
     real dos veces (un node marcando la entrada + un way con el contorno
     del edificio, ambos con el mismo tag) -eso no es un duplicado a nivel
     OSM (son dos elementos con id distinto) pero sí lo es en el mapa.
  5. Inserta todo en SQLite con INSERT OR IGNORE sobre (osm_type, osm_id)
     -la clave natural y estable que da OSM- así correr el script de nuevo
     nunca duplica lugares ya importados.

No reemplaza a LUGARES_PRECARGADOS (src/data/lugaresRepo.js) ni a Firestore
-esos siguen siendo la fuente de datos que usa la app hoy-. Esto es un
punto de partida para nutrir esa base con datos reales, a revisar/curar
antes de subirlos a producción (OSM es colaborativo: nombres o categorías
pueden venir incompletos o desactualizados).
"""

import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# --- Configuración -----------------------------------------------------

# Corrientes Capital, Argentina (sur, oeste, norte, este). Cubre el macro-
# centro, la costanera y los barrios linderos; ajustar si hace falta un
# radio más chico/grande. Se puede sacar un bbox de una zona con
# https://boundingbox.klokantech.com (formato "CSV").
BBOX_CORRIENTES = (-27.53, -58.92, -27.41, -58.75)  # (south, west, north, east)

# Varios mirrors de la misma red pública (todos sirven la misma base OSM):
# si uno da 429/504 (ocupado -es un servicio gratuito y compartido, pasa
# seguido en horas pico) se reintenta con el siguiente antes de rendirse.
OVERPASS_ENDPOINTS = [
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
TIMEOUT_HTTP_S = 90  # "out geom" trae toda la geometría de cada way, pesa más que "out center" y puede tardar

# La política de uso de Overpass pide un User-Agent identificable (no el
# default "python-requests/x.x" -algunos mirrors lo devuelven 406/403).
HEADERS_HTTP = {"User-Agent": "RutaCorrentina-ImportadorLugares/1.0 (uso interno, ver backend/importador_lugares)"}

DB_PATH = Path(__file__).parent / "lugares_osm.db"


# --- 1. Consulta Overpass QL --------------------------------------------

def construir_query(bbox: tuple[float, float, float, float]) -> str:
    """
    Arma la consulta Overpass QL. Pide nodos Y ways (node/way) para cada
    categoría porque en OSM un lugar puede estar mapeado como un punto
    (node) o como un polígono (way) -una plaza o una playa casi siempre son
    polígonos-.

    Pedimos "out geom;" (geometría completa: todos los nodos del contorno,
    no solo un punto ya calculado) en vez de "out center;". El "center" que
    calcula Overpass NO es el centroide real del área del polígono: es el
    punto medio del bounding box de sus nodos. Para una forma convexa y
    compacta (una plaza cuadrada) da casi lo mismo, pero para una forma
    larga/curva/cóncava que bordea la costa -una playa o una costanera que
    sigue la curva del río- el punto medio del bounding box cae afuera del
    polígono con bastante frecuencia, del lado del agua. Con la geometría
    completa calculamos nosotros el centroide de área real (ver
    _centroide_poligono), que si o si cae dentro de la forma.
    """
    s, w, n, e = bbox
    bbox_str = f"{s},{w},{n},{e}"

    # regex "^(a|b|c)$" en vez de repetir el filtro por cada valor: Overpass
    # QL soporta la misma sintaxis de regex que se usa para filtrar tags.
    filtros = [
        ('amenity', '^(restaurant|cafe)$'),   # restaurantes y cafeterías
        ('tourism', '^(museum|hotel|guest_house)$'),  # museos y hoteles
        # Solo "monument" (obras conmemorativas relevantes para turismo).
        # "memorial" se probó y se descartó a propósito: OSM lo usa para
        # cualquier placa o busto chico (73 de 93 resultados de "cultura"
        # en la primera corrida real eran memorial, no museos/monumentos
        # de interés turístico) -inflaba la categoría con ruido.
        ('historic', '^monument$'),
        ('natural', '^beach$'),                # playas
        ('place', '^square$'),                 # plazas
    ]

    lineas = []
    for tag, patron in filtros:
        lineas.append(f'  node["{tag}"~"{patron}"]({bbox_str});')
        lineas.append(f'  way["{tag}"~"{patron}"]({bbox_str});')

    cuerpo = "\n".join(lineas)
    return f"""
[out:json][timeout:{TIMEOUT_HTTP_S}];
(
{cuerpo}
);
out geom;
""".strip()


def consultar_overpass(query: str) -> dict:
    """
    POSTea la query a Overpass. Reintenta contra el mirror si el servidor
    principal falla (timeout, 429 "too many requests", 504 "gateway
    timeout" son comunes en este servicio público y compartido -no son un
    bug del script, hay que tratarlos como transitorios).
    """
    ultimo_error = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            print(f"Consultando {endpoint} ...")
            respuesta = requests.post(endpoint, data={"data": query}, headers=HEADERS_HTTP, timeout=TIMEOUT_HTTP_S)
            respuesta.raise_for_status()
            return respuesta.json()
        except requests.exceptions.RequestException as error:
            ultimo_error = error
            print(f"  -> falló ({error}); probando siguiente endpoint si hay uno.")
            time.sleep(2)

    raise RuntimeError(f"No se pudo consultar Overpass en ningún endpoint. Último error: {ultimo_error}")


# --- 2. Parseo y estructuración -----------------------------------------

# tag -> valor -> (categoria de la app, tipo_osm legible). El orden importa:
# se revisa en este orden y se usa el primer tag que matchee. "categoria"
# usa el mismo vocabulario que ya filtra la app (ver
# backend/asistente_ia/query_builder.py: CATEGORIAS_VALIDAS) + "alojamiento",
# que es nueva -los hoteles no encajan en gastronomia/naturaleza/cultura/
# playas-. Si se quiere que el frontend los filtre, hay que sumar ese pill
# nuevo en index.html (ver .filter-pill en la barra de categorías del mapa).
MAPEO_CATEGORIA = [
    ("amenity", "restaurant", "gastronomia", "restaurante"),
    ("amenity", "cafe", "gastronomia", "cafetería"),
    ("tourism", "museum", "cultura", "museo"),
    ("historic", "monument", "cultura", "monumento"),
    ("natural", "beach", "playas", "playa"),
    ("place", "square", "naturaleza", "plaza"),
    ("tourism", "hotel", "alojamiento", "hotel"),
    ("tourism", "guest_house", "alojamiento", "hospedaje"),
]


def determinar_categoria_y_tipo(tags: dict) -> tuple[str, str] | None:
    for tag_key, tag_valor, categoria, tipo_legible in MAPEO_CATEGORIA:
        if tags.get(tag_key) == tag_valor:
            return categoria, tipo_legible
    return None  # no matchea ninguna categoría que nos interese -se descarta


def extraer_direccion(tags: dict) -> tuple[str | None, str | None, str | None]:
    """calle, altura, direccion combinada -None si OSM no tiene el dato (es
    habitual: muchos POIs en OSM no tienen addr:* cargado)."""
    calle = tags.get("addr:street")
    altura = tags.get("addr:housenumber")
    if calle and altura:
        direccion = f"{calle} {altura}"
    elif calle:
        direccion = calle
    else:
        direccion = None
    return calle, altura, direccion


def _centroide_poligono(geometria: list[dict]) -> tuple[float, float] | None:
    """
    Centroide de ÁREA real de un polígono (fórmula del shoelace), a partir
    de la lista de nodos que da Overpass con "out geom;". A diferencia del
    "center" que calcula Overpass (punto medio del bounding box), este
    punto queda garantizado *dentro* del polígono para cualquier forma
    simple -incluidas las cóncavas/curvas como una costanera o una playa
    que bordea el río-.

    Devuelve None si la geometría no alcanza para definir un área (menos de
    3 puntos, o puntos degenerados/colineales -un "way" que en realidad es
    una línea abierta, no un polígono cerrado) -en ese caso el caller cae
    a un promedio simple de los puntos.
    """
    puntos = [(p["lat"], p["lon"]) for p in geometria if "lat" in p and "lon" in p]
    if len(puntos) < 3:
        return None
    if puntos[0] != puntos[-1]:
        puntos = puntos + [puntos[0]]  # cerrar el anillo si Overpass no lo mandó cerrado

    area = 0.0
    cx = 0.0
    cy = 0.0
    for (lat0, lng0), (lat1, lng1) in zip(puntos, puntos[1:]):
        cruce = lng0 * lat1 - lng1 * lat0
        area += cruce
        cx += (lng0 + lng1) * cruce
        cy += (lat0 + lat1) * cruce
    area *= 0.5

    if abs(area) < 1e-12:
        return None  # geometría degenerada (área ~0, ej. una línea de ida y vuelta)

    lng_centroide = cx / (6 * area)
    lat_centroide = cy / (6 * area)
    return lat_centroide, lng_centroide


def parsear_elementos(data: dict) -> list[dict]:
    """
    Convierte la respuesta cruda de Overpass en una lista de dicts limpios,
    uno por lugar, descartando lo que no sirve:
      - sin "name" (no tiene sentido mostrar un lugar sin nombre en la UI)
      - sin categoría reconocida (no debería pasar dado que la query ya
        filtra por esos tags, pero un elemento puede tener varios tags a
        la vez y ninguno calzar exacto -se valida igual, no se asume)
      - sin coordenadas resueltas (geometría vacía/degenerada y sin nodos,
        caso raro pero posible)
    """
    lugares = []
    descartados = 0

    for elemento in data.get("elements", []):
        tags = elemento.get("tags", {})

        nombre = tags.get("name", "").strip()
        if not nombre:
            descartados += 1
            continue

        categoria_tipo = determinar_categoria_y_tipo(tags)
        if categoria_tipo is None:
            descartados += 1
            continue
        categoria, tipo_osm = categoria_tipo

        tipo_elemento = elemento.get("type")  # 'node' | 'way' | 'relation'
        if tipo_elemento == "node":
            lat, lng = elemento.get("lat"), elemento.get("lon")
        else:
            geometria = elemento.get("geometry", [])
            centroide = _centroide_poligono(geometria)
            if centroide is not None:
                lat, lng = centroide
            elif geometria:
                # fallback: promedio simple de los puntos (geometría no
                # cerraba un área -ej. una línea-, pero hay nodos igual)
                lat = sum(p["lat"] for p in geometria) / len(geometria)
                lng = sum(p["lon"] for p in geometria) / len(geometria)
            else:
                lat, lng = None, None

        # float() explícito con la precisión completa que manda Overpass
        # (7 decimales ~ 1cm de resolución) -nunca guardar como string, ver
        # crear_tabla(): las columnas son REAL, no TEXT.
        lat = float(lat) if lat is not None else None
        lng = float(lng) if lng is not None else None

        if lat is None or lng is None:
            descartados += 1
            continue

        calle, altura, direccion = extraer_direccion(tags)

        lugares.append({
            "osm_type": tipo_elemento,
            "osm_id": elemento.get("id"),
            "nombre": nombre,
            "categoria": categoria,
            "tipo_osm": tipo_osm,
            "lat": lat,
            "lng": lng,
            "calle": calle,
            "altura": altura,
            "direccion": direccion,
        })

    print(f"Parseados {len(lugares)} lugares válidos ({descartados} descartados por falta de nombre/categoría/coords).")
    return lugares


def _distancia_metros(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia entre dos coordenadas (fórmula de Haversine)."""
    from math import radians, sin, cos, sqrt, atan2
    radio_tierra_m = 6_371_000
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * radio_tierra_m * atan2(sqrt(a), sqrt(1 - a))


def deduplicar_por_nombre_y_cercania(lugares: list[dict], radio_m: float = 30) -> list[dict]:
    """
    Colapsa lugares con el mismo nombre (case-insensitive) ubicados a menos
    de radio_m entre sí -el caso típico de un mismo lugar real mapeado como
    node (punto de entrada) Y como way (contorno del edificio) en OSM,
    ambos con el mismo name/tags-. Entre los dos, se queda con el node: su
    lat/lng es un punto puesto a mano en la ubicación real, mientras que la
    de un way es el centroide geométrico del polígono (que en un edificio
    en forma de L, por ejemplo, puede caer fuera del edificio).

    O(n²) en cantidad de lugares -de sobra para el volumen de una ciudad
    (decenas/cientos de resultados por corrida), no pensado para un bbox
    con decenas de miles de elementos.
    """
    aceptados: list[dict] = []
    fusionados = 0

    for lugar in lugares:
        nombre_norm = lugar["nombre"].strip().lower()
        indice_existente = next(
            (i for i, otro in enumerate(aceptados)
             if otro["nombre"].strip().lower() == nombre_norm
             and _distancia_metros(lugar["lat"], lugar["lng"], otro["lat"], otro["lng"]) <= radio_m),
            None,
        )

        if indice_existente is None:
            aceptados.append(lugar)
        else:
            fusionados += 1
            ya_aceptado = aceptados[indice_existente]
            if lugar["osm_type"] == "node" and ya_aceptado["osm_type"] != "node":
                aceptados[indice_existente] = lugar

    if fusionados:
        print(f"Dedup por nombre+cercanía: {fusionados} lugares fusionados (mismo nombre a <{radio_m:.0f}m).")
    return aceptados


# --- 3. Inserción en SQLite ---------------------------------------------

def crear_tabla(conexion: sqlite3.Connection):
    """
    UNIQUE(osm_type, osm_id) es la clave del anti-duplicados: es el
    identificador estable que asigna OSM a cada elemento, así que
    corresponde 1:1 con "es el mismo lugar real" -mucho más confiable que
    dedupear por nombre (dos lugares distintos pueden compartir nombre, o
    el mismo lugar puede tener variaciones de mayúsculas/tildes entre
    corridas).
    """
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS lugares_osm (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            osm_type TEXT NOT NULL,
            osm_id INTEGER NOT NULL,
            nombre TEXT NOT NULL,
            categoria TEXT NOT NULL,
            tipo_osm TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            calle TEXT,
            altura TEXT,
            direccion TEXT,
            fecha_importacion TEXT NOT NULL,
            UNIQUE (osm_type, osm_id)
        )
    """)
    conexion.commit()


def insertar_lugares(conexion: sqlite3.Connection, lugares: list[dict]) -> tuple[int, int]:
    """
    INSERT OR IGNORE fila por fila (en vez de executemany) para poder
    contar cuántos se insertaron de verdad vs. cuántos ya existían
    -executemany no expone un rowcount confiable por fila en sqlite3-.
    Devuelve (insertados, duplicados_ignorados).
    """
    ahora = datetime.now(timezone.utc).isoformat()
    insertados = 0
    duplicados = 0

    with conexion:  # commit/rollback automático al salir del bloque
        for lugar in lugares:
            cursor = conexion.execute(
                """
                INSERT OR IGNORE INTO lugares_osm
                    (osm_type, osm_id, nombre, categoria, tipo_osm, lat, lng, calle, altura, direccion, fecha_importacion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    lugar["osm_type"], lugar["osm_id"], lugar["nombre"], lugar["categoria"],
                    lugar["tipo_osm"], lugar["lat"], lugar["lng"], lugar["calle"],
                    lugar["altura"], lugar["direccion"], ahora,
                ),
            )
            if cursor.rowcount == 1:
                insertados += 1
            else:
                duplicados += 1

    return insertados, duplicados


# --- Orquestación --------------------------------------------------------

def main():
    query = construir_query(BBOX_CORRIENTES)
    print("Query Overpass QL:\n" + query + "\n")

    try:
        data = consultar_overpass(query)
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)

    lugares = parsear_elementos(data)
    if not lugares:
        print("No se encontró ningún lugar válido -revisá el bbox o los filtros.")
        return

    lugares = deduplicar_por_nombre_y_cercania(lugares)

    conexion = sqlite3.connect(DB_PATH)
    try:
        crear_tabla(conexion)
        insertados, duplicados = insertar_lugares(conexion, lugares)
    finally:
        conexion.close()

    print(f"\nListo. {insertados} lugares nuevos insertados, {duplicados} ya existían (se ignoraron). "
          f"Base: {DB_PATH}")


if __name__ == "__main__":
    main()
