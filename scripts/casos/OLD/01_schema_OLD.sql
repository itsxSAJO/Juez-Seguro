-- ============================================================================
-- JUEZ SEGURO - Base de Datos de Casos (FDP)
-- Esquema de Expedientes y Pseudonimización
-- ============================================================================
-- Common Criteria: FDP (User Data Protection)
-- Implementa pseudonimización para protección de datos sensibles
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLA: jurisdicciones
-- Propósito: Catálogo de jurisdicciones del sistema judicial
-- ============================================================================
CREATE TABLE jurisdicciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    provincia VARCHAR(100),
    canton VARCHAR(100),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA: tipos_causa
-- Propósito: Catálogo de tipos de causas judiciales
-- ============================================================================
CREATE TABLE tipos_causa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    materia VARCHAR(50) NOT NULL, -- 'CIVIL', 'PENAL', 'LABORAL', etc.
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA: causas
-- Propósito: Registro principal de causas judiciales
-- NOTA: Usa pseudónimos en lugar de datos personales directos
-- ============================================================================
CREATE TABLE causas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_causa VARCHAR(50) NOT NULL UNIQUE,
    
    -- Clasificación
    tipo_causa_id UUID NOT NULL REFERENCES tipos_causa(id),
    jurisdiccion_id UUID NOT NULL REFERENCES jurisdicciones(id),
    materia VARCHAR(50) NOT NULL,
    
    -- Estado del proceso
    estado VARCHAR(30) NOT NULL DEFAULT 'INGRESADO',
    etapa_procesal VARCHAR(50),
    
    -- Fechas importantes
    fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_audiencia DATE,
    fecha_sentencia DATE,
    fecha_cierre DATE,
    
    -- Referencias pseudonimizadas (FDP_PSE)
    -- Los IDs reales se mapean en tabla separada
    juez_pseudonimo VARCHAR(50),
    demandante_pseudonimo VARCHAR(50),
    demandado_pseudonimo VARCHAR(50),
    
    -- Resumen (sin datos sensibles)
    descripcion_publica TEXT,
    observaciones TEXT,
    
    -- Prioridad y urgencia
    prioridad INTEGER NOT NULL DEFAULT 3,
    es_urgente BOOLEAN NOT NULL DEFAULT false,
    
    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_pseudonimo VARCHAR(50),
    
    -- Restricciones
    CONSTRAINT chk_estado CHECK (estado IN ('INGRESADO', 'EN_TRAMITE', 'AUDIENCIA_PROGRAMADA', 'EN_DECISION', 'SENTENCIADO', 'ARCHIVADO', 'APELACION')),
    CONSTRAINT chk_prioridad CHECK (prioridad BETWEEN 1 AND 5)
);

-- Índices optimizados
CREATE INDEX idx_causas_numero ON causas(numero_causa);
CREATE INDEX idx_causas_estado ON causas(estado);
CREATE INDEX idx_causas_tipo ON causas(tipo_causa_id);
CREATE INDEX idx_causas_jurisdiccion ON causas(jurisdiccion_id);
CREATE INDEX idx_causas_fecha_ingreso ON causas(fecha_ingreso);
CREATE INDEX idx_causas_juez ON causas(juez_pseudonimo);

-- ============================================================================
-- TABLA: pseudonimos_mapeo
-- Propósito: Mapeo seguro entre pseudónimos y referencias reales
-- CRÍTICO: Acceso restringido, encriptación en aplicación
-- ============================================================================
CREATE TABLE pseudonimos_mapeo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pseudonimo VARCHAR(50) NOT NULL UNIQUE,
    tipo_entidad VARCHAR(30) NOT NULL, -- 'USUARIO', 'PERSONA', 'ORGANIZACION'
    referencia_encriptada TEXT NOT NULL, -- ID real encriptado con clave de aplicación
    salt VARCHAR(64) NOT NULL,
    
    -- Control
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_tipo_entidad CHECK (tipo_entidad IN ('USUARIO', 'PERSONA', 'ORGANIZACION'))
);

CREATE INDEX idx_pseudonimos_tipo ON pseudonimos_mapeo(tipo_entidad);

-- ============================================================================
-- TABLA: documentos
-- Propósito: Metadatos de documentos del expediente
-- ============================================================================
CREATE TABLE documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    causa_id UUID NOT NULL REFERENCES causas(id) ON DELETE CASCADE,
    
    -- Identificación
    codigo VARCHAR(50) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    tipo_documento VARCHAR(50) NOT NULL,
    
    -- Archivo (referencia, no contenido)
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_almacenamiento TEXT NOT NULL,
    tamanio_bytes BIGINT,
    hash_sha256 VARCHAR(64) NOT NULL, -- Integridad
    mime_type VARCHAR(100),
    
    -- Estado
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    firmado BOOLEAN NOT NULL DEFAULT false,
    fecha_firma TIMESTAMPTZ,
    firmado_por_pseudonimo VARCHAR(50),
    
    -- Visibilidad
    es_publico BOOLEAN NOT NULL DEFAULT false,
    nivel_confidencialidad INTEGER NOT NULL DEFAULT 2,
    
    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subido_por_pseudonimo VARCHAR(50),
    
    CONSTRAINT chk_estado_doc CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'FIRMADO')),
    CONSTRAINT chk_confidencialidad CHECK (nivel_confidencialidad BETWEEN 1 AND 5)
);

CREATE INDEX idx_documentos_causa ON documentos(causa_id);
CREATE INDEX idx_documentos_tipo ON documentos(tipo_documento);
CREATE INDEX idx_documentos_estado ON documentos(estado);

-- ============================================================================
-- TABLA: audiencias
-- Propósito: Programación y registro de audiencias
-- ============================================================================
CREATE TABLE audiencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    causa_id UUID NOT NULL REFERENCES causas(id) ON DELETE CASCADE,
    
    -- Programación
    tipo_audiencia VARCHAR(50) NOT NULL,
    fecha_programada TIMESTAMPTZ NOT NULL,
    duracion_estimada_minutos INTEGER DEFAULT 60,
    sala VARCHAR(50),
    modalidad VARCHAR(20) NOT NULL DEFAULT 'PRESENCIAL',
    
    -- Estado
    estado VARCHAR(30) NOT NULL DEFAULT 'PROGRAMADA',
    fecha_inicio_real TIMESTAMPTZ,
    fecha_fin_real TIMESTAMPTZ,
    
    -- Participantes (pseudonimizados)
    juez_pseudonimo VARCHAR(50),
    secretario_pseudonimo VARCHAR(50),
    
    -- Resultado
    acta_id UUID REFERENCES documentos(id),
    observaciones TEXT,
    
    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    programada_por_pseudonimo VARCHAR(50),
    
    CONSTRAINT chk_estado_aud CHECK (estado IN ('PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'REPROGRAMADA')),
    CONSTRAINT chk_modalidad CHECK (modalidad IN ('PRESENCIAL', 'VIRTUAL', 'HIBRIDA'))
);

CREATE INDEX idx_audiencias_causa ON audiencias(causa_id);
CREATE INDEX idx_audiencias_fecha ON audiencias(fecha_programada);
CREATE INDEX idx_audiencias_estado ON audiencias(estado);

-- ============================================================================
-- TABLA: notificaciones
-- Propósito: Registro de notificaciones judiciales
-- ============================================================================
CREATE TABLE notificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    causa_id UUID NOT NULL REFERENCES causas(id) ON DELETE CASCADE,
    documento_id UUID REFERENCES documentos(id),
    
    -- Destinatario (pseudonimizado)
    destinatario_pseudonimo VARCHAR(50) NOT NULL,
    tipo_notificacion VARCHAR(50) NOT NULL,
    
    -- Contenido
    asunto VARCHAR(255) NOT NULL,
    contenido TEXT,
    
    -- Estado de entrega
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    fecha_envio TIMESTAMPTZ,
    fecha_lectura TIMESTAMPTZ,
    intentos_envio INTEGER NOT NULL DEFAULT 0,
    
    -- Método
    canal VARCHAR(30) NOT NULL DEFAULT 'EMAIL',
    
    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enviada_por_pseudonimo VARCHAR(50),
    
    CONSTRAINT chk_estado_notif CHECK (estado IN ('PENDIENTE', 'ENVIADA', 'ENTREGADA', 'LEIDA', 'FALLIDA')),
    CONSTRAINT chk_canal CHECK (canal IN ('EMAIL', 'SMS', 'CASILLERO', 'FISICO'))
);

CREATE INDEX idx_notificaciones_causa ON notificaciones(causa_id);
CREATE INDEX idx_notificaciones_destinatario ON notificaciones(destinatario_pseudonimo);
CREATE INDEX idx_notificaciones_estado ON notificaciones(estado);

-- ============================================================================
-- FUNCIÓN: Actualizar timestamp de modificación
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_causas_updated_at
    BEFORE UPDATE ON causas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documentos_updated_at
    BEFORE UPDATE ON documentos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audiencias_updated_at
    BEFORE UPDATE ON audiencias
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ============================================================================
COMMENT ON TABLE causas IS 'Expedientes judiciales con datos pseudonimizados según FDP';
COMMENT ON TABLE pseudonimos_mapeo IS 'TABLA CRÍTICA: Mapeo de pseudónimos a identidades reales - Acceso restringido';
COMMENT ON TABLE documentos IS 'Metadatos de documentos del expediente con verificación de integridad';
COMMENT ON TABLE audiencias IS 'Programación y seguimiento de audiencias judiciales';
