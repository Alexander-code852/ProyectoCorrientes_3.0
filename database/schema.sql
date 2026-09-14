-- ============================================================
-- RUTA CORRENTINA — Esquema relacional (Pasaporte Digital)
-- ============================================================
-- Diseño de referencia para una eventual capa relacional (MySQL 8+ /
-- PostgreSQL) de la plataforma. La app actual persiste sus datos en
-- Firestore (ver src/services/firebaseService.js) — este esquema es
-- independiente de eso, pensado para un backend SQL propio o para una
-- futura migración.
--
-- Nombres de campo alineados con los que ya usa la app:
--   lugares:  nombre, descripcion, categoria, lat/lng (firebaseService.js)
--   usuarios: nombre/avatar/visitados/favoritos (templates.js, perfil)
--
-- Relaciones:
--   niveles (catálogo)  1───N  usuarios
--   usuarios  1───N  favoritos  N───1  lugares   (tabla puente, PK compuesta)
--   usuarios  1───N  visitados  N───1  lugares   (historial de check-ins)
--
-- Decisiones de diseño:
--   - "visitados" tiene PK propia (id_visita), no compuesta: permite
--     múltiples check-ins históricos en el mismo lugar (revisitar
--     vuelve a sumar puntos), a diferencia de "favoritos" que es un
--     estado único por par usuario-lugar.
--   - "niveles" es 100% escalable: agregar Nivel 5, 6, etc. es solo un
--     INSERT, sin tocar el esquema. Recalcular id_nivel_actual del
--     usuario se hace en la capa de aplicación (o con un trigger)
--     después de cada INSERT en visitados, comparando puntos_totales
--     contra puntos_requeridos.
--   - ON DELETE CASCADE en favoritos/visitados: si se borra un usuario
--     o lugar, se limpia su historial asociado. Si se prefiere
--     conservar el historial de puntos aunque se borre un lugar,
--     cambiar esa FK a ON DELETE RESTRICT o usar borrado lógico
--     (columna activo BOOLEAN) en lugares en vez de DELETE.
--   - usuarios.verificado/token_verificacion/token_expira: cuenta de
--     registro con verificación por email obligatoria antes de poder
--     usar funciones privadas (favoritos, check-ins, puntos). Ver
--     database/auth.py para las funciones de registro/verificación/login
--     y database/auth_frontend_example.js para el bloqueo de UI.
-- ============================================================


-- ============================================================
-- VERSIÓN POSTGRESQL
-- ============================================================

CREATE TABLE niveles (
    id_nivel            SERIAL PRIMARY KEY,
    nombre_nivel        VARCHAR(50)  NOT NULL,
    puntos_requeridos   INTEGER      NOT NULL UNIQUE,
    beneficios          VARCHAR(255)
);

CREATE TABLE usuarios (
    id_usuario          SERIAL PRIMARY KEY,
    email               VARCHAR(150) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    nombre_usuario      VARCHAR(100),
    avatar_url          VARCHAR(255),
    puntos_totales      INTEGER      NOT NULL DEFAULT 0,
    id_nivel_actual     INTEGER      NOT NULL DEFAULT 1
        REFERENCES niveles(id_nivel) ON DELETE RESTRICT,
    -- Verificación de cuenta por email (ver database/auth.py para el flujo completo)
    verificado          BOOLEAN      NOT NULL DEFAULT FALSE,
    token_verificacion  VARCHAR(255),   -- hash SHA-256 del token, nunca en texto plano
    token_expira        TIMESTAMP,
    fecha_creacion      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lugares (
    id_lugar            SERIAL PRIMARY KEY,
    nombre              VARCHAR(150) NOT NULL,
    descripcion         TEXT,
    categoria           VARCHAR(50)  NOT NULL,
    latitud             DECIMAL(10, 8) NOT NULL,
    longitud            DECIMAL(11, 8) NOT NULL,
    fecha_creacion      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE favoritos (
    id_usuario          INTEGER   NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_lugar            INTEGER   NOT NULL REFERENCES lugares(id_lugar)   ON DELETE CASCADE,
    fecha_agregado      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_usuario, id_lugar)
);

CREATE TABLE visitados (
    id_visita           SERIAL PRIMARY KEY,
    id_usuario          INTEGER   NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_lugar            INTEGER   NOT NULL REFERENCES lugares(id_lugar)   ON DELETE CASCADE,
    fecha_visita        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    puntos_obtenidos    INTEGER   NOT NULL DEFAULT 0
);

CREATE INDEX idx_lugares_categoria         ON lugares(categoria);
CREATE INDEX idx_favoritos_lugar           ON favoritos(id_lugar);
CREATE INDEX idx_visitados_usuario         ON visitados(id_usuario);
CREATE INDEX idx_visitados_lugar           ON visitados(id_lugar);
CREATE INDEX idx_usuarios_token_verificacion ON usuarios(token_verificacion);

-- Catálogo inicial de niveles (escalable: agregar filas, no columnas)
INSERT INTO niveles (nombre_nivel, puntos_requeridos, beneficios) VALUES
    ('Explorador',          0,   'Acceso al mapa y check-ins básicos'),
    ('Aventurero',          100, 'Insignia de perfil + acceso a rutas destacadas'),
    ('Baqueano',            300, 'Descuentos en comercios adheridos'),
    ('Leyenda Correntina',  600, 'Beneficios premium y eventos exclusivos');

-- ============================================================
-- EXTENSIÓN: Asistente Local Inteligente (backend/asistente_ia/)
-- ============================================================
-- Columnas nuevas en "lugares" para que query_builder.py pueda filtrar por
-- ambiente/espacio/clima además de categoría. Todas con DEFAULT para no
-- romper las filas ya cargadas (quedan en su valor más "neutro" hasta que
-- se completen a mano o por importación).
ALTER TABLE lugares ADD COLUMN ambiente                 VARCHAR(20)   NOT NULL DEFAULT 'cualquiera';
ALTER TABLE lugares ADD COLUMN es_techado                BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE lugares ADD COLUMN tiene_sombra              BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE lugares ADD COLUMN tiene_aire_acondicionado  BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE lugares ADD COLUMN activo                    BOOLEAN      NOT NULL DEFAULT TRUE;
ALTER TABLE lugares ADD COLUMN calificacion_promedio     DECIMAL(2,1) NOT NULL DEFAULT 0;


-- ============================================================
-- VERSIÓN MYSQL (8+)
-- ============================================================
-- Ejecutar esta sección en un esquema/base separada de la versión
-- PostgreSQL de arriba (los nombres de tabla son los mismos).

CREATE TABLE niveles (
    id_nivel            INT AUTO_INCREMENT PRIMARY KEY,
    nombre_nivel        VARCHAR(50)  NOT NULL,
    puntos_requeridos   INT          NOT NULL UNIQUE,
    beneficios          VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE usuarios (
    id_usuario          INT AUTO_INCREMENT PRIMARY KEY,
    email               VARCHAR(150) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    nombre_usuario      VARCHAR(100),
    avatar_url          VARCHAR(255),
    puntos_totales      INT          NOT NULL DEFAULT 0,
    id_nivel_actual     INT          NOT NULL DEFAULT 1,
    -- Verificación de cuenta por email (ver database/auth.py para el flujo completo)
    verificado          BOOLEAN      NOT NULL DEFAULT FALSE,
    token_verificacion  VARCHAR(255),   -- hash SHA-256 del token, nunca en texto plano
    token_expira        TIMESTAMP,
    fecha_creacion      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_nivel_actual) REFERENCES niveles(id_nivel) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE lugares (
    id_lugar            INT AUTO_INCREMENT PRIMARY KEY,
    nombre              VARCHAR(150) NOT NULL,
    descripcion         TEXT,
    categoria           VARCHAR(50)  NOT NULL,
    latitud             DECIMAL(10, 8) NOT NULL,
    longitud            DECIMAL(11, 8) NOT NULL,
    fecha_creacion      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE favoritos (
    id_usuario          INT       NOT NULL,
    id_lugar            INT       NOT NULL,
    fecha_agregado      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_usuario, id_lugar),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_lugar)   REFERENCES lugares(id_lugar)   ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE visitados (
    id_visita           INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario          INT       NOT NULL,
    id_lugar            INT       NOT NULL,
    fecha_visita        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    puntos_obtenidos    INT       NOT NULL DEFAULT 0,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_lugar)   REFERENCES lugares(id_lugar)   ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_lugares_categoria         ON lugares(categoria);
CREATE INDEX idx_favoritos_lugar           ON favoritos(id_lugar);
CREATE INDEX idx_visitados_usuario         ON visitados(id_usuario);
CREATE INDEX idx_visitados_lugar           ON visitados(id_lugar);
CREATE INDEX idx_usuarios_token_verificacion ON usuarios(token_verificacion);

INSERT INTO niveles (nombre_nivel, puntos_requeridos, beneficios) VALUES
    ('Explorador',          0,   'Acceso al mapa y check-ins básicos'),
    ('Aventurero',          100, 'Insignia de perfil + acceso a rutas destacadas'),
    ('Baqueano',            300, 'Descuentos en comercios adheridos'),
    ('Leyenda Correntina',  600, 'Beneficios premium y eventos exclusivos');

-- Extensión: Asistente Local Inteligente (backend/asistente_ia/) — mismas
-- columnas que la versión PostgreSQL de más arriba.
ALTER TABLE lugares ADD COLUMN ambiente                 VARCHAR(20)   NOT NULL DEFAULT 'cualquiera';
ALTER TABLE lugares ADD COLUMN es_techado                BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE lugares ADD COLUMN tiene_sombra              BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE lugares ADD COLUMN tiene_aire_acondicionado  BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE lugares ADD COLUMN activo                    BOOLEAN      NOT NULL DEFAULT TRUE;
ALTER TABLE lugares ADD COLUMN calificacion_promedio     DECIMAL(2,1) NOT NULL DEFAULT 0;
