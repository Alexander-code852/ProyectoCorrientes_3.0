"""
backend/asistente_ia/api.py

Endpoint HTTP que el frontend (src/services/asistenteLocalIA.js) llama vía
fetch. Orquesta los tres pasos: NLP -> clima -> query SQL, y devuelve los
lugares recomendados en JSON.

Server de referencia (FastAPI) — no forma parte del hosting estático actual
de la app (ver CLAUDE.md: hoy no hay backend Python corriendo). Para
probarlo:

    pip install -r backend/asistente_ia/requirements.txt
    export ANTHROPIC_API_KEY=...
    export OPENWEATHER_API_KEY=...
    export DATABASE_URL=postgresql://usuario:pass@host:5432/ruta_correntina
    uvicorn backend.asistente_ia.api:app --reload

y apuntar ASISTENTE_API_URL (src/services/asistenteLocalIA.js) a esa URL, o
exponerlo bajo el mismo dominio del frontend como "/api/asistente" (reverse
proxy / Cloud Run / Cloud Function).
"""

import os
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import psycopg2
import psycopg2.extras

# ASISTENTE_USAR_STUB_NLP=1 -> usa nlp_engine_stub.py (reglas de palabras
# clave, sin llamar a un LLM) para poder probar el resto del pipeline
# (clima + SQL) sin tener todavía una API key de Anthropic/OpenAI/Gemini.
# En producción no se setea esta variable y se usa el motor real.
if os.environ.get("ASISTENTE_USAR_STUB_NLP") == "1":
    from .nlp_engine_stub import interpretar_consulta
else:
    from .nlp_engine import interpretar_consulta

from .clima_context import obtener_clima_actual
from .query_builder import construir_query_recomendacion
from ..recomendaciones.api import router as recomendaciones_router
from ..importador_lugares.api import router as lugares_osm_router

# Sin DATABASE_URL seteada usamos un dataset chico en memoria
# (lugares_demo.py) en vez de conectarnos a Postgres, para poder probar el
# pipeline NLP -> clima -> búsqueda de punta a punta en una máquina que
# todavía no tiene una base real. Con DATABASE_URL seteada, este modo no se
# usa nunca: se consulta Postgres como corresponde en producción.
USAR_DB_MEMORIA = "DATABASE_URL" not in os.environ
if USAR_DB_MEMORIA:
    from .lugares_demo import buscar_lugares_demo

app = FastAPI(title="Asistente Local Inteligente - Ruta Correntina")

# En producción, reemplazar "*" por el dominio real donde se sirve index.html.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# /api/recomendaciones-hoy (tarjeta "Recomendado para hoy" del mapa) —
# ver backend/recomendaciones/api.py.
app.include_router(recomendaciones_router)

# /api/lugares-osm (lugares importados desde OpenStreetMap) —
# ver backend/importador_lugares/api.py.
app.include_router(lugares_osm_router)


class ConsultaAsistente(BaseModel):
    mensaje: str
    lat: float | None = None
    lon: float | None = None


# Red de seguridad: cualquier excepción no prevista (ej. DATABASE_URL sin
# setear, la DB caída, un KeyError) cae acá en vez de dejar que Starlette
# devuelva "Internal Server Error" en texto plano — el frontend siempre
# recibe JSON parseable, tal como espera consultarAsistente().
@app.exception_handler(Exception)
async def manejar_error_no_previsto(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Ocurrió un error inesperado en el asistente. Probá de nuevo en un momento."},
    )


def conectar_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


# Clima "neutro" cuando no se puede consultar OpenWeather (sin coordenadas,
# API caída, timeout): mejor devolver una recomendación sin ese ajuste que
# no devolver nada.
CLIMA_NEUTRO = {"temperatura": None, "lloviendo": False, "hace_calor": False, "descripcion": None}


@app.post("/api/asistente")
def consultar_asistente(payload: ConsultaAsistente):
    if not payload.mensaje.strip():
        raise HTTPException(400, "El mensaje no puede estar vacío.")

    try:
        intencion = interpretar_consulta(payload.mensaje)
    except Exception:
        raise HTTPException(502, "No se pudo interpretar la consulta. Probá reformularla.")

    clima = CLIMA_NEUTRO
    if payload.lat is not None and payload.lon is not None:
        try:
            clima = obtener_clima_actual(payload.lat, payload.lon)
        except Exception:
            pass  # sin clima seguimos funcionando, solo sin ese ajuste

    if USAR_DB_MEMORIA:
        lugares = buscar_lugares_demo(intencion, clima)
    else:
        query, parametros = construir_query_recomendacion(intencion, clima)
        conexion = conectar_db()
        try:
            with conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute(query, parametros)
                lugares = cursor.fetchall()
        finally:
            conexion.close()

    return {
        "intencion": intencion,
        "clima": clima,
        "recomendaciones": lugares
    }
