"""
backend/asistente_ia/query_builder.py

Arma dinámicamente el WHERE de la consulta sobre la tabla `lugares` (ver
database/schema.sql, sección "Extensión: Asistente Local Inteligente")
combinando lo que pidió el usuario (intención) con las restricciones que
impone el clima ahora mismo.

Usa siempre parámetros (placeholders %s), nunca f-strings con valores del
usuario o del modelo insertados directo en el SQL — evita inyección SQL
aunque el LLM "alucine" un valor fuera de los enums esperados (por eso
además se valida contra listas cerradas antes de armar cada condición).
"""

CATEGORIAS_VALIDAS = {"gastronomia", "naturaleza", "cultura", "playas"}
AMBIENTES_VALIDOS = {"tranquilo", "animado", "romantico", "familiar"}


def construir_query_recomendacion(intencion: dict, clima: dict, limite: int = 5) -> tuple[str, list]:
    condiciones = ["activo = TRUE"]
    parametros = []

    # --- Filtros por lo que pidió el usuario ---
    categoria = intencion.get("categoria_sugerida")
    if categoria in CATEGORIAS_VALIDAS:
        condiciones.append("categoria = %s")
        parametros.append(categoria)

    ambiente = intencion.get("ambiente")
    if ambiente in AMBIENTES_VALIDOS:
        condiciones.append("ambiente = %s")
        parametros.append(ambiente)

    espacio_deseado = intencion.get("espacio")  # 'interior' | 'exterior' | 'cualquiera'

    # --- El clima manda sobre lo que pidió el usuario cuando llueve: no
    # tiene sentido mandarlo a un lugar al aire libre aunque lo haya pedido
    # explícitamente. Sin lluvia, se respeta la preferencia de espacio. ---
    if clima["lloviendo"]:
        condiciones.append("es_techado = TRUE")
    elif espacio_deseado == "interior":
        condiciones.append("es_techado = TRUE")
    elif espacio_deseado == "exterior":
        condiciones.append("es_techado = FALSE")

    # Con calor y sin lluvia, priorizar lugares con sombra o A/C (si además
    # llueve, ya está resuelto arriba forzando interior).
    if clima["hace_calor"] and not clima["lloviendo"]:
        condiciones.append("(tiene_sombra = TRUE OR tiene_aire_acondicionado = TRUE)")

    query = f"""
        SELECT id_lugar, nombre, descripcion, categoria, es_techado, latitud, longitud
        FROM lugares
        WHERE {' AND '.join(condiciones)}
        ORDER BY calificacion_promedio DESC
        LIMIT %s
    """
    parametros.append(limite)

    return query, parametros
