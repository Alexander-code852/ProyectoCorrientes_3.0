"""
backend/recomendaciones/api.py

Endpoint de la tarjeta "Recomendado para hoy" del mapa (ver index.html:
#recomendacion-hoy-card, consumido por src/services/recomendacionHoy.js).
Aplica la regla de negocio por franja horaria (mañana/tarde/noche) y
devuelve una LISTA de 3 a 5 lugares en vez de uno solo, para que el
frontend los vaya rotando sin recargar la página.

Se monta como router dentro de la misma app FastAPI que ya expone
/api/asistente (ver backend/asistente_ia/api.py) para no tener que levantar
un segundo proceso/puerto -- pero es independiente en datos (SQLite propio,
ver db.py) y se puede probar solo:

    uvicorn backend.recomendaciones.api:app_standalone --reload --port 8002
"""

from datetime import datetime
from fastapi import APIRouter, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .db import obtener_lugares_por_franja

router = APIRouter()


def franja_actual(hora: int | None = None) -> str:
    """mañana: 6-11:59 | tarde: 12-18:59 | noche: 19-5:59."""
    h = hora if hora is not None else datetime.now().hour
    if 6 <= h < 12:
        return "mañana"
    if 12 <= h < 19:
        return "tarde"
    return "noche"


@router.get("/api/recomendaciones-hoy")
def recomendaciones_hoy(limite: int = Query(5, ge=3, le=5)):
    franja = franja_actual()
    filas = obtener_lugares_por_franja(franja, limite)

    return {
        "franja": franja,
        "recomendaciones": [
            {
                "id_lugar": fila["id_lugar"],
                "titulo": fila["titulo"],
                "descripcion": fila["descripcion"],
                "coordenadas": {"lat": fila["lat"], "lng": fila["lng"]},
            }
            for fila in filas
        ],
    }


# Permite levantar este endpoint solo (sin asistente_ia) durante desarrollo:
# `uvicorn backend.recomendaciones.api:app_standalone --port 8002`. La app
# "real" en producción es la de asistente_ia/api.py, que incluye este mismo
# router (app.include_router(router)) bajo el mismo puerto/origen.
app_standalone = FastAPI(title="Recomendaciones del día - Ruta Correntina")
app_standalone.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"]
)
app_standalone.include_router(router)
