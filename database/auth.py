# ============================================================
# RUTA CORRENTINA — Lógica de autenticación y verificación
# ============================================================
# Pseudocódigo Python, agnóstico de framework (Flask/FastAPI/Django),
# pensado para la tabla `usuarios` de database/schema.sql. Independiente
# del backend actual (Firebase Auth, ver src/ui/authUI.js) — es el
# diseño de referencia para una eventual capa de auth propia sobre SQL.
#
# `db` representa cualquier capa de acceso a datos con esta interfaz:
#   db.usuarios.existe(email) -> bool
#   db.usuarios.buscar(email) -> Usuario | None
#   db.usuarios.insertar(**campos) -> id
#   db.usuarios.actualizar(id, **campos) -> None

import bcrypt
import secrets
import hashlib
import datetime

TOKEN_VALIDEZ_MINUTOS = 30


def hash_token(token_plano: str) -> str:
    """SHA-256 del token de verificación: es lo único que se guarda en DB."""
    return hashlib.sha256(token_plano.encode()).hexdigest()


def crear_usuario(email: str, password: str, db, enviar_email):
    """Registra la cuenta como no verificada y dispara el email con el token."""
    if db.usuarios.existe(email=email):
        # Mensaje genérico: no confirmar/negar si el email ya existe evita
        # que alguien mapee qué correos están registrados (user enumeration).
        raise ValueError("No se pudo completar el registro")

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    token_plano = secrets.token_urlsafe(32)  # esto es lo que va por email
    token_hash = hash_token(token_plano)     # esto es lo que se guarda
    expira = datetime.datetime.utcnow() + datetime.timedelta(minutes=TOKEN_VALIDEZ_MINUTOS)

    usuario_id = db.usuarios.insertar(
        email=email,
        password_hash=password_hash,
        verificado=False,
        token_verificacion=token_hash,
        token_expira=expira,
    )

    enviar_email(
        destinatario=email,
        asunto="Verificá tu cuenta - Ruta Correntina",
        cuerpo=f"Tu código de verificación es: {token_plano}\nVence en {TOKEN_VALIDEZ_MINUTOS} minutos.",
    )
    return usuario_id


def verificar_usuario(email: str, token_ingresado: str, db):
    """Valida el token contra el hash guardado y activa la cuenta."""
    usuario = db.usuarios.buscar(email=email)
    if usuario is None:
        raise ValueError("Token inválido")  # mismo error que "vencido/incorrecto": no revelar si el email existe

    if usuario.verificado:
        return True  # idempotente: verificar dos veces no debe romper nada

    if usuario.token_expira is None or usuario.token_expira < datetime.datetime.utcnow():
        raise ValueError("El código expiró, pedí uno nuevo")

    if usuario.token_verificacion != hash_token(token_ingresado):
        raise ValueError("Código incorrecto")

    db.usuarios.actualizar(
        id=usuario.id,
        verificado=True,
        token_verificacion=None,  # se invalida: no reutilizable
        token_expira=None,
    )
    return True


def login(email: str, password: str, db, crear_sesion):
    """Revisa credenciales y exige cuenta verificada antes de emitir sesión."""
    usuario = db.usuarios.buscar(email=email)

    # bcrypt.checkpw contra un hash dummy si no existe el usuario evita que
    # el tiempo de respuesta delate si el email está o no registrado.
    hash_a_comparar = usuario.password_hash if usuario else bcrypt.hashpw(b"dummy", bcrypt.gensalt()).decode()
    password_valida = bcrypt.checkpw(password.encode(), hash_a_comparar.encode())

    if usuario is None or not password_valida:
        raise AuthError("Email o contraseña incorrectos")

    if not usuario.verificado:
        raise CuentaNoVerificadaError("Tenés que verificar tu email antes de iniciar sesión")

    return crear_sesion(usuario.id)  # JWT o session id opaco, con expiración corta


class AuthError(Exception):
    pass


class CuentaNoVerificadaError(Exception):
    pass


def requiere_verificacion(func):
    """Decorador para endpoints privados (favoritos, check-in, puntos, etc.).
    Esta es la barrera real: el bloqueo en el frontend (ver
    auth_frontend_example.js) es solo UX, nunca la única protección."""
    def wrapper(request, *args, **kwargs):
        usuario = autenticar_por_sesion(request)
        if usuario is None:
            return error(401, "No autenticado")
        if not usuario.verificado:
            return error(403, "Cuenta no verificada")
        return func(request, usuario, *args, **kwargs)
    return wrapper


# Ejemplo de uso:
#
# @requiere_verificacion
# def endpoint_agregar_favorito(request, usuario, lugar_id):
#     ...
#
# @requiere_verificacion
# def endpoint_checkin(request, usuario, lugar_id):
#     ...
