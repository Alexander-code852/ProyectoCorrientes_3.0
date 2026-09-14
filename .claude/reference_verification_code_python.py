"""
REFERENCIA STANDALONE - NO INTEGRADO A ESTE PROYECTO
======================================================
Ruta Correntina es una PWA de HTML/CSS/JS puro con Firebase Auth desde el
navegador (ver src/ui/authUI.js) — no tiene backend Python ni servidor
propio, así que este archivo no se importa ni se ejecuta desde la app.

Se entrega solo porque se pidió explícitamente la lógica en Python para un
flujo de código de verificación de 4-6 dígitos por email. Si en el futuro
se agrega un backend real a este proyecto (o se usa en otra app), esta es
la forma estándar de implementarlo:
  1. Generar un código numérico aleatorio.
  2. Guardarlo con una expiración (acá en memoria; en producción, en una
     base de datos como Firestore/Postgres/Redis).
  3. Mandarlo por email con smtplib (o un servicio como SendGrid/SES).
  4. Validar que el código ingresado coincida y no haya expirado.
"""

import random
import smtplib
import time
from dataclasses import dataclass
from email.mime.text import MIMEText

# --- Configuración del remitente (usar variables de entorno en producción,
#     nunca credenciales hardcodeadas) ---
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "tu_correo@gmail.com"
SMTP_PASSWORD = "tu_contraseña_de_aplicación"  # nunca la contraseña real de la cuenta

CODE_LENGTH = 6
CODE_TTL_SECONDS = 10 * 60  # el código vence a los 10 minutos


@dataclass
class PendingVerification:
    code: str
    expires_at: float


# Mock de "base de datos": en producción esto sería una tabla/colección con
# el email como clave, no un dict en memoria del proceso.
_pending_verifications: dict[str, PendingVerification] = {}


def generar_codigo() -> str:
    """Código numérico de CODE_LENGTH dígitos, con ceros a la izquierda."""
    numero = random.randint(0, 10**CODE_LENGTH - 1)
    return str(numero).zfill(CODE_LENGTH)


def enviar_codigo_verificacion(destinatario: str) -> None:
    """Genera un código, lo guarda con expiración y lo envía por email."""
    codigo = generar_codigo()
    _pending_verifications[destinatario] = PendingVerification(
        code=codigo,
        expires_at=time.time() + CODE_TTL_SECONDS,
    )

    mensaje = MIMEText(
        f"Tu código de verificación para Ruta Correntina es: {codigo}\n"
        f"Vence en {CODE_TTL_SECONDS // 60} minutos."
    )
    mensaje["Subject"] = "Verificá tu correo - Ruta Correntina"
    mensaje["From"] = SMTP_USER
    mensaje["To"] = destinatario

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as servidor:
        servidor.starttls()
        servidor.login(SMTP_USER, SMTP_PASSWORD)
        servidor.send_message(mensaje)


def validar_codigo(destinatario: str, codigo_ingresado: str) -> bool:
    """True si el código coincide y todavía no venció."""
    pendiente = _pending_verifications.get(destinatario)
    if pendiente is None:
        return False

    if time.time() > pendiente.expires_at:
        del _pending_verifications[destinatario]
        return False

    es_valido = pendiente.code == codigo_ingresado.strip()
    if es_valido:
        del _pending_verifications[destinatario]  # un código, un solo uso
    return es_valido


# --- Ejemplo de los 3 estados del modal (login/registro/verificación),
#     como pediste, en un esqueleto sin framework específico ---
class AuthModalState:
    LOGIN = "login"
    REGISTER = "register"
    VERIFY = "verify"


class AuthModalController:
    """Esqueleto de la máquina de estados del modal. Cablear submit()/
    verify() a un formulario real (Flask/FastAPI/Streamlit/etc.) según el
    framework que se use en ese otro proyecto."""

    def __init__(self):
        self.state = AuthModalState.LOGIN
        self.pending_email: str | None = None

    def go_to_register(self):
        self.state = AuthModalState.REGISTER

    def go_to_login(self):
        self.state = AuthModalState.LOGIN
        self.pending_email = None

    def submit_register(self, email: str, password: str):
        # Acá iría crear el usuario en tu base de datos (hasheando la
        # contraseña, ej. con passlib/bcrypt) ANTES de habilitarlo.
        enviar_codigo_verificacion(email)
        self.pending_email = email
        self.state = AuthModalState.VERIFY

    def submit_verification_code(self, codigo_ingresado: str) -> bool:
        if not self.pending_email:
            return False
        ok = validar_codigo(self.pending_email, codigo_ingresado)
        if ok:
            # Acá marcarías al usuario como verificado en la base de datos.
            self.state = AuthModalState.LOGIN
        return ok
