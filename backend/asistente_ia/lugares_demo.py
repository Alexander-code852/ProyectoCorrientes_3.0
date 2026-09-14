"""
backend/asistente_ia/lugares_demo.py

Dataset en memoria + filtro que replica las mismas condiciones de
query_builder.py, SOLO para poder probar el pipeline completo
(NLP -> clima -> "búsqueda" -> respuesta) en una máquina que no tiene
Postgres instalado ni un DATABASE_URL real todavía.

api.py lo usa en vez de conectarse a la base cuando DATABASE_URL no está
seteada (ver ASISTENTE_USAR_DB_MEMORIA en api.py). No reemplaza al schema
real de database/schema.sql — el día que haya una Postgres real con
DATABASE_URL seteada, este archivo deja de usarse solo.
"""

LUGARES_DEMO = [
    {"id_lugar": 1, "nombre": "Costanera General San Martín", "descripcion": "Paseo a orillas del río Paraná, ideal para caminar o tomar mate al aire libre.",
     "categoria": "naturaleza", "ambiente": "tranquilo", "es_techado": False, "tiene_sombra": True, "tiene_aire_acondicionado": False, "calificacion_promedio": 4.7},
    {"id_lugar": 2, "nombre": "Plaza Cabral", "descripcion": "Plaza central histórica, rodeada de bares y con mucho movimiento.",
     "categoria": "cultura", "ambiente": "animado", "es_techado": False, "tiene_sombra": True, "tiene_aire_acondicionado": False, "calificacion_promedio": 4.5},
    {"id_lugar": 3, "nombre": "Museo de Bellas Artes Dr. Juan Ramón Vidal", "descripcion": "Museo con obras de artistas correntinos, ambiente tranquilo bajo techo.",
     "categoria": "cultura", "ambiente": "tranquilo", "es_techado": True, "tiene_sombra": False, "tiene_aire_acondicionado": True, "calificacion_promedio": 4.4},
    {"id_lugar": 4, "nombre": "Playa Arazaty", "descripcion": "Balneario sobre el río, ideal para nadar y pasar el día en familia.",
     "categoria": "playas", "ambiente": "familiar", "es_techado": False, "tiene_sombra": True, "tiene_aire_acondicionado": False, "calificacion_promedio": 4.6},
    {"id_lugar": 5, "nombre": "Mercado Central Dr. Sabás Zabala", "descripcion": "Mercado tradicional con puestos de comida y productos regionales.",
     "categoria": "gastronomia", "ambiente": "animado", "es_techado": True, "tiene_sombra": False, "tiene_aire_acondicionado": False, "calificacion_promedio": 4.2},
    {"id_lugar": 6, "nombre": "Resto-bar La Puerta Roja", "descripcion": "Bar con patio techado y aire acondicionado, buena opción para una cena romántica.",
     "categoria": "gastronomia", "ambiente": "romantico", "es_techado": True, "tiene_sombra": False, "tiene_aire_acondicionado": True, "calificacion_promedio": 4.8},
    {"id_lugar": 7, "nombre": "Parque Mitre", "descripcion": "Parque urbano con juegos infantiles y espacios verdes para toda la familia.",
     "categoria": "naturaleza", "ambiente": "familiar", "es_techado": False, "tiene_sombra": True, "tiene_aire_acondicionado": False, "calificacion_promedio": 4.3},
    {"id_lugar": 8, "nombre": "Teatro Vera", "descripcion": "Teatro histórico con programación cultural, sala cerrada y climatizada.",
     "categoria": "cultura", "ambiente": "tranquilo", "es_techado": True, "tiene_sombra": False, "tiene_aire_acondicionado": True, "calificacion_promedio": 4.9},
    {"id_lugar": 9, "nombre": "Café de la Esquina", "descripcion": "Café tranquilo con mesas en vereda, ideal para tomar algo con calma.",
     "categoria": "gastronomia", "ambiente": "tranquilo", "es_techado": True, "tiene_sombra": True, "tiene_aire_acondicionado": True, "calificacion_promedio": 4.5},
]

CATEGORIAS_VALIDAS = {"gastronomia", "naturaleza", "cultura", "playas"}
AMBIENTES_VALIDOS = {"tranquilo", "animado", "romantico", "familiar"}


def buscar_lugares_demo(intencion: dict, clima: dict, limite: int = 5) -> list[dict]:
    categoria = intencion.get("categoria_sugerida")
    ambiente = intencion.get("ambiente")
    espacio_deseado = intencion.get("espacio")

    if clima["lloviendo"]:
        espacio_requerido = "interior"
    else:
        espacio_requerido = espacio_deseado

    resultado = []
    for lugar in LUGARES_DEMO:
        if categoria in CATEGORIAS_VALIDAS and lugar["categoria"] != categoria:
            continue
        if ambiente in AMBIENTES_VALIDOS and lugar["ambiente"] != ambiente:
            continue
        if espacio_requerido == "interior" and not lugar["es_techado"]:
            continue
        if espacio_requerido == "exterior" and lugar["es_techado"]:
            continue
        if clima["hace_calor"] and not clima["lloviendo"]:
            if not (lugar["tiene_sombra"] or lugar["tiene_aire_acondicionado"]):
                continue
        resultado.append(lugar)

    resultado.sort(key=lambda l: l["calificacion_promedio"], reverse=True)
    return resultado[:limite]
