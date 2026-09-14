"""
backend/asistente_ia/nlp_engine.py

Motor de NLP e Intención del "Asistente Local Inteligente".

Traduce una consulta en lenguaje natural del usuario (ej. "busco un lugar
tranquilo para tomar mates esta tarde") en un JSON estructurado con los
parámetros clave que después usa query_builder.py para armar el filtro SQL.

Usa "tool use" (function calling) de Anthropic en vez de pedirle al modelo
que devuelva JSON en texto libre: forzando la respuesta a un tool_call con
un input_schema fijo evitamos que agregue texto alrededor del JSON, cierre
mal una llave o cambie el nombre de una clave. El mismo enfoque aplica 1:1
con OpenAI (`tools` + `tool_choice`) o Gemini (`function_calling_config`) —
ver el bloque comentado al final para el equivalente con OpenAI.
"""

import os
from anthropic import Anthropic

client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# Esquema de la intención que el modelo debe devolver. "actividad" es libre
# (texto corto) porque el usuario puede pedir casi cualquier cosa; el resto
# son enums cerrados para que query_builder.py pueda mapearlos 1:1 a columnas
# sin tener que interpretar variaciones de texto libre.
EXTRAER_INTENCION_TOOL = {
    "name": "extraer_intencion_turistica",
    "description": (
        "Extrae la intención estructurada de una consulta turística en "
        "lenguaje natural sobre lugares de Corrientes, Argentina."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "actividad": {
                "type": "string",
                "description": "Actividad principal, ej. 'tomar mate', 'comer', 'nadar'. Cadena vacía si no se menciona."
            },
            "ambiente": {
                "type": "string",
                "enum": ["tranquilo", "animado", "romantico", "familiar", "cualquiera"],
                "description": "Tipo de ambiente buscado."
            },
            "espacio": {
                "type": "string",
                "enum": ["interior", "exterior", "cualquiera"],
                "description": "Si busca un espacio techado/interior o al aire libre."
            },
            "momento_dia": {
                "type": "string",
                "enum": ["mañana", "tarde", "noche", "ahora"],
                "description": "Momento del día mencionado o implícito (ej. 'esta tarde' -> 'tarde')."
            },
            "categoria_sugerida": {
                "type": "string",
                "enum": ["gastronomia", "naturaleza", "cultura", "playas", "cualquiera"],
                "description": "Categoría de lugares (de las que ya maneja la app) más cercana a la consulta."
            }
        },
        "required": ["actividad", "ambiente", "espacio", "momento_dia", "categoria_sugerida"]
    }
}


def interpretar_consulta(texto_usuario: str) -> dict:
    """
    Envía el texto del usuario a Claude y devuelve la intención ya
    estructurada como dict. Lanza ValueError si el modelo no usó la tool
    (no debería pasar con tool_choice forzado, pero se valida por las dudas
    en vez de asumirlo silenciosamente).
    """
    respuesta = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=300,
        tools=[EXTRAER_INTENCION_TOOL],
        tool_choice={"type": "tool", "name": "extraer_intencion_turistica"},
        messages=[{"role": "user", "content": texto_usuario}]
    )

    for bloque in respuesta.content:
        if bloque.type == "tool_use" and bloque.name == "extraer_intencion_turistica":
            return bloque.input  # el SDK ya lo entrega parseado como dict

    raise ValueError("El modelo no devolvió la intención estructurada esperada.")


# --- Equivalente con OpenAI (referencia, no se ejecuta) ---------------------
#
# import json
# from openai import OpenAI
#
# client_openai = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
#
# respuesta = client_openai.chat.completions.create(
#     model="gpt-4o",
#     messages=[{"role": "user", "content": texto_usuario}],
#     tools=[{"type": "function", "function": EXTRAER_INTENCION_TOOL}],
#     tool_choice={"type": "function", "function": {"name": "extraer_intencion_turistica"}}
# )
# intencion = json.loads(respuesta.choices[0].message.tool_calls[0].function.arguments)
#
# --- Equivalente con Gemini (referencia, no se ejecuta) ---------------------
#
# import google.generativeai as genai
#
# genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
# modelo = genai.GenerativeModel(
#     "gemini-1.5-pro",
#     tools=[{"function_declarations": [EXTRAER_INTENCION_TOOL]}]
# )
# respuesta = modelo.generate_content(
#     texto_usuario,
#     tool_config={"function_calling_config": {"mode": "ANY"}}
# )
# intencion = dict(respuesta.candidates[0].content.parts[0].function_call.args)
