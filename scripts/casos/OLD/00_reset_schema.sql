-- ============================================================================
-- JUEZ SEGURO - Base de Datos de Casos (RESET)
-- Cumple con FDP_IFF (Flujo de información anonimizado) y gestión operativa
-- ============================================================================

-- Eliminar tablas existentes en orden correcto (por dependencias)
DROP TABLE IF EXISTS expedientes CASCADE;
DROP TABLE IF EXISTS causas CASCADE;
DROP TABLE IF EXISTS mapa_pseudonimos CASCADE;

-- ============================================================================
-- NUEVO ESQUEMA
-- ============================================================================

-- Mapeo de Identidad Anónima (CRÍTICO para Anonimización)
-- Esta tabla rompe el vínculo directo con la BD de Usuarios para consultas públicas
CREATE TABLE mapa_pseudonimos (
    mapa_id SERIAL PRIMARY KEY,
    juez_id_real INT UNIQUE NOT NULL, -- Referencia lógica a DB_Usuarios
    pseudonimo_publico VARCHAR(50) UNIQUE NOT NULL, -- Ej: "N5-442"
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla Principal de Causas
CREATE TABLE causas (
    causa_id SERIAL PRIMARY KEY,
    numero_proceso VARCHAR(50) UNIQUE NOT NULL, -- Formato Oficial
    materia VARCHAR(100) NOT NULL,
    tipo_proceso VARCHAR(100) NOT NULL,
    unidad_judicial VARCHAR(100) NOT NULL,
    
    -- Relación con el Juez (Se guardan ambos para uso interno vs público)
    juez_asignado_id INT NOT NULL, -- ID Real (Para gestión interna del Juez)
    juez_pseudonimo VARCHAR(50) NOT NULL, -- ID Público (Para visualización Ciudadana)
    
    secretario_creador_id INT NOT NULL,
    estado_procesal VARCHAR(50) DEFAULT 'INICIADA',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expediente Electrónico (Contenedor de documentos)
CREATE TABLE expedientes (
    expediente_id SERIAL PRIMARY KEY,
    causa_id INT REFERENCES causas(causa_id),
    fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT
);

-- Tabla de Audiencias
CREATE TABLE audiencias (
    audiencia_id SERIAL PRIMARY KEY,
    causa_id INT REFERENCES causas(causa_id) ON DELETE CASCADE,
    tipo_audiencia VARCHAR(100) NOT NULL,
    fecha_programada TIMESTAMP NOT NULL,
    duracion_minutos INT DEFAULT 60,
    sala VARCHAR(50),
    modalidad VARCHAR(20) DEFAULT 'PRESENCIAL',
    estado VARCHAR(30) DEFAULT 'PROGRAMADA',
    observaciones TEXT,
    programado_por_id INT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_estado_aud CHECK (estado IN ('PROGRAMADA', 'EN_CURSO', 'REALIZADA', 'CANCELADA', 'REPROGRAMADA')),
    CONSTRAINT chk_modalidad CHECK (modalidad IN ('PRESENCIAL', 'VIRTUAL', 'HIBRIDA'))
);

-- Tabla de Notificaciones
CREATE TABLE notificaciones (
    notificacion_id SERIAL PRIMARY KEY,
    causa_id INT REFERENCES causas(causa_id) ON DELETE CASCADE,
    tipo_notificacion VARCHAR(50) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT NOT NULL,
    destinatario_id INT,
    remitente_id INT,
    estado VARCHAR(30) DEFAULT 'PENDIENTE',
    fecha_envio TIMESTAMP,
    fecha_lectura TIMESTAMP,
    prioridad VARCHAR(20) DEFAULT 'NORMAL',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_estado_not CHECK (estado IN ('PENDIENTE', 'ENVIADA', 'LEIDA', 'ARCHIVADA')),
    CONSTRAINT chk_prioridad CHECK (prioridad IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE'))
);

-- Índices para optimización
CREATE INDEX idx_causas_numero ON causas(numero_proceso);
CREATE INDEX idx_causas_juez ON causas(juez_asignado_id);
CREATE INDEX idx_causas_estado ON causas(estado_procesal);
CREATE INDEX idx_causas_materia ON causas(materia);
CREATE INDEX idx_mapa_juez ON mapa_pseudonimos(juez_id_real);
CREATE INDEX idx_mapa_pseudo ON mapa_pseudonimos(pseudonimo_publico);
CREATE INDEX idx_expedientes_causa ON expedientes(causa_id);
CREATE INDEX idx_audiencias_causa ON audiencias(causa_id);
CREATE INDEX idx_audiencias_fecha ON audiencias(fecha_programada);
CREATE INDEX idx_audiencias_estado ON audiencias(estado);
CREATE INDEX idx_notificaciones_causa ON notificaciones(causa_id);
CREATE INDEX idx_notificaciones_destinatario ON notificaciones(destinatario_id);
CREATE INDEX idx_notificaciones_estado ON notificaciones(estado);

-- Verificación
SELECT 'Tablas de casos creadas correctamente' AS resultado;
\dt
