"""
backend/importador_lugares/api.py

Endpoint de ejemplo que expone lugares_osm.db (poblada por
extraer_overpass.py) como GeoJSON, listo para que Leaflet los dibuje
directo con L.geoJSON(...) en el frontend.

Ojo con el orden de coordenadas: GeoJSON es [lng, lat] (X, Y), al revés de
como Leaflet las pide para L.marker/L.latLng ([lat, lng]) -si el frontend
arma markers a mano desde este JSON, hay que invertir el par.
"""

import sqlite3
from pathlib import Path

from fastapi import APIRouter, Query

DB_PATH = Path(__file__).parent / "lugares_osm.db"

router = APIRouter()


def _conexion():
    conexion = sqlite3.connect(DB_PATH)
    conexion.row_factory = sqlite3.Row
    return conexion


@router.get("/api/lugares-osm")
def lugares_osm(categoria: str | None = Query(None, description="Filtra por categoria, ej. 'gastronomia'")):
    conexion = _conexion()
    try:
        if categoria:
            filas = conexion.execute(
                "SELECT * FROM lugares_osm WHERE categoria = ? ORDER BY nombre", (categoria,)
            ).fetchall()
        else:
            filas = conexion.execute("SELECT * FROM lugares_osm ORDER BY nombre").fetchall()
    finally:
        conexion.close()

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [fila["lng"], fila["lat"]]},
                "properties": {
                    "id_lugar": fila["id"],
                    "nombre": fila["nombre"],
                    "categoria": fila["categoria"],
                    "tipo_osm": fila["tipo_osm"],
                    "direccion": fila["direccion"],
                },
            }
            for fila in filas
        ],
    }
