"""
backend/asistente_ia/nlp_engine_stub.py

Reemplazo de nlp_engine.py SOLO para pruebas locales sin clave de LLM
(Anthropic/OpenAI/Gemini). Interpreta la consulta con reglas de
palabras clave en vez de un modelo real — sirve para validar que el resto
del pipeline (clima -> query SQL -> respuesta) funciona de punta a punta,
pero NO reemplaza al motor de verdad: no entiende sinónimos, contexto ni
consultas fuera de estas palabras.

api.py importa este módulo en vez de nlp_engine.py solo cuando la variable
de entorno ASISTENTE_USAR_STUB_NLP=1 está seteada (ver api.py).
"""

PALABRAS_AMBIENTE = {
    "tranquilo": "tranquilo", "tranquila": "tranquilo", "calma": "tranquilo",
    "animado": "animado", "animada": "animado", "movido": "animado",
    "romantico": "romantico", "romántico": "romantico", "pareja": "romantico",
    "familiar": "familiar", "familia": "familiar", "chicos": "familiar", "niños": "familiar"
}

PALABRAS_ESPACIO = {
    "techado": "interior", "interior": "interior", "adentro": "interior", "cerrado": "interior",
    "exterior": "exterior", "afuera": "exterior", "aire libre": "exterior"
}

PALABRAS_CATEGORIA = {
    "comer": "gastronomia", "comida": "gastronomia", "mate": "gastronomia", "mates": "gastronomia",
    "cafe": "gastronomia", "café": "gastronomia", "restaurante": "gastronomia",
    "playa": "playas", "río": "playas", "rio": "playas", "nadar": "playas",
    "museo": "cultura", "cultura": "cultura", "arte": "cultura",
    "parque": "naturaleza", "naturaleza": "naturaleza", "plaza": "naturaleza"
}


def _buscar(texto_lower: str, diccionario: dict, default: str) -> str:
    for palabra, valor in diccionario.items():
        if palabra in texto_lower:
            return valor
    return default


def interpretar_consulta(texto_usuario: str) -> dict:
    texto_lower = texto_usuario.lower()

    momento_dia = "ahora"
    if "mañana" in texto_lower:
        momento_dia = "mañana"
    elif "tarde" in texto_lower:
        momento_dia = "tarde"
    elif "noche" in texto_lower:
        momento_dia = "noche"

    return {
        "actividad": texto_usuario.strip(),
        "ambiente": _buscar(texto_lower, PALABRAS_AMBIENTE, "cualquiera"),
        "espacio": _buscar(texto_lower, PALABRAS_ESPACIO, "cualquiera"),
        "momento_dia": momento_dia,
        "categoria_sugerida": _buscar(texto_lower, PALABRAS_CATEGORIA, "cualquiera")
    }
