"""
backend/recomendaciones/db.py

Base SQLite de la tarjeta "Recomendado para hoy" (ver index.html:
#recomendacion-hoy-card y src/services/recomendacionHoy.js). Elegimos
SQLite acá -y no la Postgres de backend/asistente_ia/- porque es un
catálogo chico y de solo lectura: no justifica un servidor de base de datos
aparte. El archivo .db se crea y se siembra solo la primera vez que se
importa este módulo (ver _inicializar() al final del archivo), así que no
hace falta ningún paso manual de setup para probarlo.
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "recomendaciones.db"

# "cualquiera" matchea las 3 franjas: se usa para lugares que no dependen
# del momento del día (ej. un mirador). mañana=parques/cafeterías,
# tarde=costanera/museos/playas, noche=bares/eventos, según lo pedido.
LUGARES_SEED = [
    # (titulo, descripcion, lat, lng, franja, categoria)
    ("Parque Mitre", "Espacios verdes y juegos infantiles, ideal para arrancar el día.", -27.4740, -58.8280, "mañana", "naturaleza"),
    ("Plaza Cabral", "Plaza histórica con bares alrededor, tranquila a primera hora.", -27.4713, -58.8339, "mañana", "cultura"),
    ("Café de la Esquina", "Café de barrio con mesas en vereda, perfecto para el desayuno.", -27.4695, -58.8312, "mañana", "gastronomia"),
    ("Vivero Municipal", "Paseo entre árboles nativos, fresco para caminar temprano.", -27.4602, -58.8125, "mañana", "naturaleza"),

    ("Costanera General San Martín", "Paseo a orillas del río Paraná, hermosa vista al agua.", -27.4685, -58.8347, "tarde", "naturaleza"),
    ("Museo de Bellas Artes Dr. Juan Ramón Vidal", "Obras de artistas correntinos, sala climatizada.", -27.4721, -58.8331, "tarde", "cultura"),
    ("Playa Arazaty", "Balneario sobre el río, ideal para nadar en familia.", -27.4587, -58.8523, "tarde", "playas"),
    ("Puente General Belgrano - Mirador", "Vista panorámica del río Paraná desde la costanera sur.", -27.4901, -58.8156, "tarde", "naturaleza"),

    ("Resto-bar La Puerta Roja", "Patio techado y climatizado, buena opción para cenar.", -27.4708, -58.8340, "noche", "gastronomia"),
    ("Teatro Vera", "Programación cultural nocturna en sala histórica.", -27.4718, -58.8322, "noche", "cultura"),
    ("Costanera - Paseo Nocturno", "Bares y foodtrucks sobre la costanera, ambiente animado de noche.", -27.4685, -58.8347, "noche", "gastronomia"),
    ("Peatonal Junín", "Zona de bares y música en vivo los fines de semana.", -27.4702, -58.8355, "noche", "gastronomia"),
]


def _crear_conexion() -> sqlite3.Connection:
    conexion = sqlite3.connect(DB_PATH)
    conexion.row_factory = sqlite3.Row
    return conexion


def _inicializar():
    conexion = _crear_conexion()
    try:
        conexion.execute("""
            CREATE TABLE IF NOT EXISTS lugares_recomendados (
                id_lugar INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo TEXT NOT NULL,
                descripcion TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                franja TEXT NOT NULL CHECK (franja IN ('mañana', 'tarde', 'noche', 'cualquiera')),
                categoria TEXT NOT NULL
            )
        """)
        hay_datos = conexion.execute("SELECT 1 FROM lugares_recomendados LIMIT 1").fetchone()
        if not hay_datos:
            conexion.executemany(
                "INSERT INTO lugares_recomendados (titulo, descripcion, lat, lng, franja, categoria) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                LUGARES_SEED,
            )
        conexion.commit()
    finally:
        conexion.close()


def obtener_lugares_por_franja(franja: str, limite: int) -> list[sqlite3.Row]:
    conexion = _crear_conexion()
    try:
        cursor = conexion.execute(
            "SELECT id_lugar, titulo, descripcion, lat, lng FROM lugares_recomendados "
            "WHERE franja = ? OR franja = 'cualquiera' "
            "ORDER BY RANDOM() LIMIT ?",
            (franja, limite),
        )
        return cursor.fetchall()
    finally:
        conexion.close()


_inicializar()
