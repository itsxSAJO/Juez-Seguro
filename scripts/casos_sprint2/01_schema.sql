-- ============================================================================
-- JUEZ SEGURO - Base de Datos de Casos (FDP)
-- Esquema actualizado y consistente con el código backend
-- Última actualización: 2026-01-05
-- ============================================================================
-- Common Criteria: FDP (User Data Protection)
-- Implementa pseudonimización para protección de datos sensibles
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLA: causas
-- Propósito: Registro principal de causas judiciales
-- NOTA: Usa pseudónimos para funcionarios, nombres reales para partes procesales
-- ============================================================================
CREATE TABLE IF NOT EXISTS causas (
    causa_id SERIAL PRIMARY KEY,
    numero_proceso VARCHAR(50) NOT NULL UNIQUE,
    
    -- Clasificación
    materia VARCHAR(100) NOT NULL,
    tipo_proceso VARCHAR(100) NOT NULL,
    unidad_judicial VARCHAR(200) NOT NULL,
    
    -- Funcionarios judiciales (referencias con ID + pseudónimo)
    juez_asignado_id INTEGER NOT NULL,  -- Referencia a funcionarios en db_usuarios
    juez_pseudonimo VARCHAR(50) NOT NULL,
    secretario_creador_id INTEGER NOT NULL,  -- Referencia a funcionarios en db_usuarios
    secretario_pseudonimo VARCHAR(50),
    
    -- Estado del proceso
    estado_procesal VARCHAR(30) NOT NULL DEFAULT 'INICIADA',
    
    -- Partes procesales (información pública - nombres reales)
    actor_nombre VARCHAR(255),
    actor_identificacion VARCHAR(20),
    demandado_nombre VARCHAR(255),
    demandado_identificacion VARCHAR(20),
    
    -- Descripción del caso
    descripcion TEXT,
    
    -- Auditoría
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    
    -- Restricciones
    CONSTRAINT chk_estado_procesal CHECK (estado_procesal IN ('INICIADA', 'EN_TRAMITE', 'RESUELTA', 'ARCHIVADA', 'SUSPENDIDA'))
);

-- Índices optimizados
CREATE INDEX IF NOT EXISTS idx_causas_numero_proceso ON causas(numero_proceso);
CREATE INDEX IF NOT EXISTS idx_causas_estado_procesal ON causas(estado_procesal);
CREATE INDEX IF NOT EXISTS idx_causas_materia ON causas(materia);
CREATE INDEX IF NOT EXISTS idx_causas_unidad_judicial ON causas(unidad_judicial);
CREATE INDEX IF NOT EXISTS idx_causas_fecha_creacion ON causas(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_causas_juez_asignado ON causas(juez_asignado_id);
CREATE INDEX IF NOT EXISTS idx_causas_secretario_creador ON causas(secretario_creador_id);
CREATE INDEX IF NOT EXISTS idx_causas_actor_nombre ON causas(actor_nombre);
CREATE INDEX IF NOT EXISTS idx_causas_demandado_nombre ON causas(demandado_nombre);

-- Comentarios para documentación
COMMENT ON TABLE causas IS 'Registro de causas judiciales con pseudonimización de funcionarios';
COMMENT ON COLUMN causas.causa_id IS 'ID único de la causa';
COMMENT ON COLUMN causas.numero_proceso IS 'Número de proceso judicial único (ej: 17281-2026-00001)';
COMMENT ON COLUMN causas.juez_pseudonimo IS 'Pseudónimo público del juez asignado (FDP_IFF)';
COMMENT ON COLUMN causas.secretario_pseudonimo IS 'Pseudónimo del secretario que registró la causa';
COMMENT ON COLUMN causas.actor_nombre IS 'Nombre del actor/demandante (información pública)';
COMMENT ON COLUMN causas.demandado_nombre IS 'Nombre del demandado/procesado (información pública)';

-- ============================================================================
-- TABLA: mapa_pseudonimos
-- Propósito: Mapeo entre IDs reales de jueces y pseudónimos públicos
-- CRÍTICO: Acceso restringido para proteger identidad
-- ============================================================================
CREATE TABLE IF NOT EXISTS mapa_pseudonimos (
    mapa_id SERIAL PRIMARY KEY,
    juez_id_real INTEGER NOT NULL UNIQUE,  -- Referencia a funcionarios.funcionario_id en db_usuarios
    pseudonimo_publico VARCHAR(50) NOT NULL UNIQUE,
    fecha_generacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mapa_pseudonimos_juez ON mapa_pseudonimos(juez_id_real);
CREATE INDEX IF NOT EXISTS idx_mapa_pseudonimos_pseudonimo ON mapa_pseudonimos(pseudonimo_publico);

COMMENT ON TABLE mapa_pseudonimos IS 'Mapeo seguro entre IDs reales de jueces y pseudónimos públicos (FDP_IFF)';
COMMENT ON COLUMN mapa_pseudonimos.juez_id_real IS 'ID real del juez en la tabla funcionarios';
COMMENT ON COLUMN mapa_pseudonimos.pseudonimo_publico IS 'Pseudónimo público usado en consultas ciudadanas';

-- ============================================================================
-- TABLA: expedientes
-- Propósito: Expedientes electrónicos asociados a causas
-- ============================================================================
CREATE TABLE IF NOT EXISTS expedientes (
    expediente_id SERIAL PRIMARY KEY,
    causa_id INTEGER NOT NULL REFERENCES causas(causa_id) ON DELETE CASCADE,
    fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    observaciones TEXT
);

CREATE INDEX IF NOT EXISTS idx_expedientes_causa ON expedientes(causa_id);

COMMENT ON TABLE expedientes IS 'Expedientes electrónicos de causas judiciales';
COMMENT ON COLUMN expedientes.causa_id IS 'Referencia a la causa asociada';

-- ============================================================================
-- TABLA: documentos
-- Propósito: Metadatos de documentos del expediente
-- ============================================================================
CREATE TABLE IF NOT EXISTS documentos (
    documento_id SERIAL PRIMARY KEY,
    causa_id INTEGER NOT NULL REFERENCES causas(causa_id) ON DELETE CASCADE,
    
    -- Identificación
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL,  -- demanda, contestacion, prueba, sentencia, auto, providencia, etc.
    
    -- Archivo
    ruta VARCHAR(500),
    formato VARCHAR(10),  -- pdf, docx
    tamano_bytes BIGINT,
    hash_integridad VARCHAR(64) NOT NULL,  -- SHA256 para verificar integridad
    
    -- Estado
    estado VARCHAR(30) NOT NULL DEFAULT 'activo',
    
    -- Auditoría
    fecha_subida TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subido_por_id INTEGER,  -- ID del funcionario que subió el documento
    
    CONSTRAINT chk_estado_documento CHECK (estado IN ('activo', 'eliminado', 'borrador', 'pendiente', 'firmado', 'notificado'))
);

CREATE INDEX IF NOT EXISTS idx_documentos_causa ON documentos(causa_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON documentos(tipo);
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON documentos(estado);
CREATE INDEX IF NOT EXISTS idx_documentos_fecha_subida ON documentos(fecha_subida);

COMMENT ON TABLE documentos IS 'Metadatos de documentos asociados a causas';
COMMENT ON COLUMN documentos.hash_integridad IS 'Hash SHA256 para verificar integridad del documento';

-- ============================================================================
-- TABLA: audiencias
-- Propósito: Programación y registro de audiencias
-- ============================================================================
CREATE TABLE IF NOT EXISTS audiencias (
    audiencia_id SERIAL PRIMARY KEY,
    causa_id INTEGER NOT NULL REFERENCES causas(causa_id) ON DELETE CASCADE,
    
    -- Programación
    tipo VARCHAR(50) NOT NULL,  -- inicial, evaluacion, juicio, resolucion, conciliacion
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    sala VARCHAR(50),
    
    -- Estado
    estado VARCHAR(30) NOT NULL DEFAULT 'programada',
    
    -- Notas y observaciones
    notas TEXT,
    
    -- Auditoría
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_estado_audiencia CHECK (estado IN ('programada', 'realizada', 'reprogramada', 'cancelada'))
);

CREATE INDEX IF NOT EXISTS idx_audiencias_causa ON audiencias(causa_id);
CREATE INDEX IF NOT EXISTS idx_audiencias_fecha ON audiencias(fecha);
CREATE INDEX IF NOT EXISTS idx_audiencias_estado ON audiencias(estado);

COMMENT ON TABLE audiencias IS 'Programación y registro de audiencias judiciales';

-- ============================================================================
-- TRIGGER: Actualizar fecha_actualizacion automáticamente
-- ============================================================================
CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_fecha_causas ON causas;
CREATE TRIGGER trigger_actualizar_fecha_causas
    BEFORE UPDATE ON causas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_fecha_audiencias ON audiencias;
CREATE TRIGGER trigger_actualizar_fecha_audiencias
    BEFORE UPDATE ON audiencias
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

-- ============================================================================
-- PERMISOS (ajustar según roles de PostgreSQL)
-- ============================================================================
-- Estos son ejemplos, ajustar según la configuración real

-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO admin_cases;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO admin_cases;

-- ============================================================================
-- FIN DEL SCHEMA
-- ============================================================================
