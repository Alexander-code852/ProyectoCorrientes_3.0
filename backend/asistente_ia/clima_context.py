"""
backend/asistente_ia/clima_context.py

Contexto en tiempo real: consulta OpenWeather para saber si conviene
recomendar un lugar techado/con sombra o uno al aire libre ahora mismo.
"""

import os
import requests

OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"

UMBRAL_CALOR_C = 30  # a partir de esta temperatura, priorizar sombra/aire acondicionado


def obtener_clima_actual(lat: float, lon: float) -> dict:
    """
    Devuelve un dict liviano con solo lo que query_builder.py necesita para
    decidir filtros, no la respuesta cruda de OpenWeather (que trae ~30 campos).

    La key se lee acá adentro (no a nivel de módulo) para que el servidor
    pueda levantar sin OPENWEATHER_API_KEY seteada — api.py ya atrapa
    cualquier excepción de esta función y sigue sin el ajuste de clima
    (ver CLIMA_NEUTRO), así que el efecto de no tener la key es "recomendar
    sin cruzar el clima", no "el servidor no arranca".
    """
    params = {
        "lat": lat,
        "lon": lon,
        "appid": os.environ["OPENWEATHER_API_KEY"],
        "units": "metric",
        "lang": "es"
    }
    respuesta = requests.get(OPENWEATHER_URL, params=params, timeout=5)
    respuesta.raise_for_status()
    datos = respuesta.json()

    condicion_id = datos["weather"][0]["id"]
    temperatura = datos["main"]["temp"]

    return {
        "temperatura": temperatura,
        # Los códigos 2xx-6xx de OpenWeather son todos precipitación
        # (tormenta, llovizna, lluvia, nieve); 7xx en adelante es otra cosa
        # (niebla/bruma/arena, nubes, despejado) — ver
        # openweathermap.org/weather-conditions
        "lloviendo": condicion_id < 700,
        "hace_calor": temperatura >= UMBRAL_CALOR_C,
        "descripcion": datos["weather"][0]["description"]
    }
