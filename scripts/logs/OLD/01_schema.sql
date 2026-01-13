-- ============================================================================
-- JUEZ SEGURO - Base de Datos de Auditoría (FAU)
-- Esquema de Logs y Trazabilidad Inmutable
-- ============================================================================
-- Common Criteria: FAU (Security Audit)
-- Implementa registro inmutable de eventos del sistema
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLA: audit_logs
-- Propósito: Registro principal de eventos de auditoría (FAU_GEN)
-- CRÍTICO: Esta tabla debe ser APPEND-ONLY (sin updates ni deletes)
-- ============================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Timestamp con precisión de microsegundos
    timestamp_evento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Identificación del evento
    tipo_evento VARCHAR(50) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    
    -- Actor (pseudonimizado para consistencia con FDP)
    usuario_pseudonimo VARCHAR(50),
    rol_usuario VARCHAR(50),
    sesion_id VARCHAR(100),
    
    -- Origen de la petición
    ip_origen INET,
    user_agent TEXT,
    endpoint VARCHAR(255),
    metodo_http VARCHAR(10),
    
    -- Recurso afectado
    recurso_tipo VARCHAR(50),
    recurso_id VARCHAR(100),
    recurso_nombre VARCHAR(255),
    
    -- Datos del evento (JSON para flexibilidad)
    datos_antes JSONB,
    datos_despues JSONB,
    parametros_request JSONB,
    
    -- Resultado
    exitoso BOOLEAN NOT NULL,
    codigo_respuesta INTEGER,
    mensaje_error TEXT,
    
    -- Integridad (FAU_STG)
    hash_registro VARCHAR(64) NOT NULL,
    hash_anterior VARCHAR(64),
    
    -- Metadatos
    servidor VARCHAR(100),
    version_api VARCHAR(20),
    
    -- Restricciones de tipos
    CONSTRAINT chk_tipo_evento CHECK (tipo_evento IN (
        'AUTENTICACION', 'AUTORIZACION', 'ACCESO_DATOS', 
        'MODIFICACION_DATOS', 'SISTEMA', 'SEGURIDAD'
    )),
    CONSTRAINT chk_categoria CHECK (categoria IN (
        'LOGIN', 'LOGOUT', 'SESION', 'USUARIO', 'ROL', 'PERMISO',
        'CAUSA', 'DOCUMENTO', 'AUDIENCIA', 'NOTIFICACION',
        'CONFIGURACION', 'ERROR', 'ALERTA_SEGURIDAD'
    ))
);

-- Índices optimizados para consultas de auditoría
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp_evento DESC);
CREATE INDEX idx_audit_usuario ON audit_logs(usuario_pseudonimo);
CREATE INDEX idx_audit_tipo ON audit_logs(tipo_evento);
CREATE INDEX idx_audit_categoria ON audit_logs(categoria);
CREATE INDEX idx_audit_recurso ON audit_logs(recurso_tipo, recurso_id);
CREATE INDEX idx_audit_exitoso ON audit_logs(exitoso) WHERE exitoso = false;
CREATE INDEX idx_audit_fecha ON audit_logs(DATE(timestamp_evento));

-- Índice para verificación de integridad de cadena
CREATE INDEX idx_audit_hash ON audit_logs(hash_registro);

-- ============================================================================
-- TABLA: audit_sesiones
-- Propósito: Registro detallado de sesiones de usuario
-- ============================================================================
CREATE TABLE audit_sesiones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identificación
    sesion_id VARCHAR(100) NOT NULL UNIQUE,
    usuario_pseudonimo VARCHAR(50) NOT NULL,
    rol_usuario VARCHAR(50),
    
    -- Tiempos
    inicio_sesion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fin_sesion TIMESTAMPTZ,
    duracion_segundos INTEGER,
    
    -- Origen
    ip_origen INET NOT NULL,
    user_agent TEXT,
    dispositivo VARCHAR(100),
    ubicacion_geografica VARCHAR(100),
    
    -- Estado
    estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVA',
    motivo_cierre VARCHAR(50),
    
    -- Métricas
    total_acciones INTEGER NOT NULL DEFAULT 0,
    acciones_fallidas INTEGER NOT NULL DEFAULT 0,
    
    -- Integridad
    hash_registro VARCHAR(64) NOT NULL,
    
    CONSTRAINT chk_estado_sesion CHECK (estado IN ('ACTIVA', 'CERRADA', 'EXPIRADA', 'REVOCADA')),
    CONSTRAINT chk_motivo_cierre CHECK (motivo_cierre IN (
        'LOGOUT_USUARIO', 'TIMEOUT_INACTIVIDAD', 'TIMEOUT_ABSOLUTO',
        'REVOCADA_ADMIN', 'SESION_DUPLICADA', 'ERROR_SISTEMA'
    ))
);

CREATE INDEX idx_audit_sesiones_usuario ON audit_sesiones(usuario_pseudonimo);
CREATE INDEX idx_audit_sesiones_estado ON audit_sesiones(estado);
CREATE INDEX idx_audit_sesiones_inicio ON audit_sesiones(inicio_sesion DESC);

-- ============================================================================
-- TABLA: audit_accesos_datos
-- Propósito: Registro específico de accesos a datos sensibles (FAU_SAR)
-- ============================================================================
CREATE TABLE audit_accesos_datos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Referencia al log principal
    audit_log_id UUID REFERENCES audit_logs(id),
    
    -- Timestamp
    timestamp_acceso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Actor
    usuario_pseudonimo VARCHAR(50) NOT NULL,
    rol_usuario VARCHAR(50),
    
    -- Recurso accedido
    tabla_accedida VARCHAR(100) NOT NULL,
    registros_accedidos INTEGER NOT NULL DEFAULT 1,
    campos_accedidos TEXT[],
    
    -- Tipo de acceso
    tipo_acceso VARCHAR(20) NOT NULL,
    
    -- Consulta (sanitizada, sin datos sensibles)
    consulta_hash VARCHAR(64),
    
    -- Justificación (para accesos especiales)
    justificacion TEXT,
    autorizado_por VARCHAR(50),
    
    -- Integridad
    hash_registro VARCHAR(64) NOT NULL,
    
    CONSTRAINT chk_tipo_acceso CHECK (tipo_acceso IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'EXPORT'))
);

CREATE INDEX idx_audit_accesos_timestamp ON audit_accesos_datos(timestamp_acceso DESC);
CREATE INDEX idx_audit_accesos_usuario ON audit_accesos_datos(usuario_pseudonimo);
CREATE INDEX idx_audit_accesos_tabla ON audit_accesos_datos(tabla_accedida);

-- ============================================================================
-- TABLA: audit_alertas_seguridad
-- Propósito: Registro de alertas y eventos de seguridad
-- ============================================================================
CREATE TABLE audit_alertas_seguridad (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Timestamp
    timestamp_alerta TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Clasificación
    severidad VARCHAR(20) NOT NULL,
    tipo_alerta VARCHAR(50) NOT NULL,
    
    -- Detalles
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT NOT NULL,
    
    -- Actor (si aplica)
    usuario_pseudonimo VARCHAR(50),
    ip_origen INET,
    
    -- Estado de la alerta
    estado VARCHAR(30) NOT NULL DEFAULT 'NUEVA',
    atendida_por VARCHAR(50),
    fecha_atencion TIMESTAMPTZ,
    resolucion TEXT,
    
    -- Datos adicionales
    datos_adicionales JSONB,
    
    -- Integridad
    hash_registro VARCHAR(64) NOT NULL,
    
    CONSTRAINT chk_severidad CHECK (severidad IN ('CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'INFO')),
    CONSTRAINT chk_tipo_alerta CHECK (tipo_alerta IN (
        'INTENTO_INTRUSION', 'FUERZA_BRUTA', 'ACCESO_NO_AUTORIZADO',
        'MODIFICACION_SOSPECHOSA', 'ESCALACION_PRIVILEGIOS', 'SESION_ANOMALA',
        'EXPORTACION_MASIVA', 'HORARIO_INUSUAL', 'UBICACION_SOSPECHOSA'
    )),
    CONSTRAINT chk_estado_alerta CHECK (estado IN ('NUEVA', 'EN_REVISION', 'RESUELTA', 'FALSO_POSITIVO', 'ESCALADA'))
);

CREATE INDEX idx_alertas_timestamp ON audit_alertas_seguridad(timestamp_alerta DESC);
CREATE INDEX idx_alertas_severidad ON audit_alertas_seguridad(severidad);
CREATE INDEX idx_alertas_estado ON audit_alertas_seguridad(estado) WHERE estado IN ('NUEVA', 'EN_REVISION');

-- ============================================================================
-- TABLA: audit_integridad_verificacion
-- Propósito: Registro de verificaciones de integridad del sistema
-- ============================================================================
CREATE TABLE audit_integridad_verificacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Timestamp
    timestamp_verificacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Tipo de verificación
    tipo_verificacion VARCHAR(50) NOT NULL,
    tabla_verificada VARCHAR(100),
    
    -- Resultados
    registros_verificados INTEGER NOT NULL,
    registros_validos INTEGER NOT NULL,
    registros_invalidos INTEGER NOT NULL DEFAULT 0,
    
    -- Estado
    resultado VARCHAR(20) NOT NULL,
    detalles_error JSONB,
    
    -- Quien ejecutó
    ejecutado_por VARCHAR(50),
    
    -- Integridad
    hash_verificacion VARCHAR(64) NOT NULL,
    
    CONSTRAINT chk_resultado CHECK (resultado IN ('OK', 'ERROR', 'ADVERTENCIA'))
);

CREATE INDEX idx_verificacion_timestamp ON audit_integridad_verificacion(timestamp_verificacion DESC);
CREATE INDEX idx_verificacion_resultado ON audit_integridad_verificacion(resultado);

-- ============================================================================
-- FUNCIÓN: Generar hash de registro para integridad
-- ============================================================================
CREATE OR REPLACE FUNCTION generar_hash_audit()
RETURNS TRIGGER AS $$
DECLARE
    contenido TEXT;
    hash_previo VARCHAR(64);
BEGIN
    -- Obtener hash del registro anterior
    SELECT hash_registro INTO hash_previo
    FROM audit_logs
    ORDER BY timestamp_evento DESC
    LIMIT 1;
    
    -- Concatenar campos relevantes
    contenido := COALESCE(NEW.timestamp_evento::TEXT, '') ||
                 COALESCE(NEW.tipo_evento, '') ||
                 COALESCE(NEW.accion, '') ||
                 COALESCE(NEW.usuario_pseudonimo, '') ||
                 COALESCE(NEW.recurso_id, '') ||
                 COALESCE(hash_previo, 'GENESIS');
    
    -- Generar hash SHA-256
    NEW.hash_registro := encode(digest(contenido, 'sha256'), 'hex');
    NEW.hash_anterior := hash_previo;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hash_audit
    BEFORE INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION generar_hash_audit();

-- ============================================================================
-- FUNCIÓN: Prevenir modificaciones (inmutabilidad)
-- ============================================================================
CREATE OR REPLACE FUNCTION prevenir_modificacion_audit()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los registros de auditoría son inmutables y no pueden ser modificados o eliminados';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_inmutabilidad_audit
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevenir_modificacion_audit();

CREATE TRIGGER trigger_inmutabilidad_sesiones
    BEFORE DELETE ON audit_sesiones
    FOR EACH ROW
    EXECUTE FUNCTION prevenir_modificacion_audit();

CREATE TRIGGER trigger_inmutabilidad_accesos
    BEFORE UPDATE OR DELETE ON audit_accesos_datos
    FOR EACH ROW
    EXECUTE FUNCTION prevenir_modificacion_audit();

-- ============================================================================
-- VISTA: Resumen de actividad por usuario
-- ============================================================================
CREATE VIEW v_actividad_usuarios AS
SELECT 
    usuario_pseudonimo,
    DATE(timestamp_evento) as fecha,
    COUNT(*) as total_acciones,
    COUNT(*) FILTER (WHERE exitoso = true) as acciones_exitosas,
    COUNT(*) FILTER (WHERE exitoso = false) as acciones_fallidas,
    COUNT(DISTINCT ip_origen) as ips_distintas,
    MIN(timestamp_evento) as primera_accion,
    MAX(timestamp_evento) as ultima_accion
FROM audit_logs
WHERE usuario_pseudonimo IS NOT NULL
GROUP BY usuario_pseudonimo, DATE(timestamp_evento);

-- ============================================================================
-- VISTA: Alertas pendientes
-- ============================================================================
CREATE VIEW v_alertas_pendientes AS
SELECT 
    id,
    timestamp_alerta,
    severidad,
    tipo_alerta,
    titulo,
    usuario_pseudonimo,
    ip_origen,
    estado
FROM audit_alertas_seguridad
WHERE estado IN ('NUEVA', 'EN_REVISION')
ORDER BY 
    CASE severidad 
        WHEN 'CRITICA' THEN 1
        WHEN 'ALTA' THEN 2
        WHEN 'MEDIA' THEN 3
        WHEN 'BAJA' THEN 4
        ELSE 5
    END,
    timestamp_alerta DESC;

-- ============================================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ============================================================================
COMMENT ON TABLE audit_logs IS 'Registro principal de auditoría - INMUTABLE - FAU_GEN';
COMMENT ON TABLE audit_sesiones IS 'Registro de sesiones de usuario para trazabilidad';
COMMENT ON TABLE audit_accesos_datos IS 'Registro de accesos a datos sensibles - FAU_SAR';
COMMENT ON TABLE audit_alertas_seguridad IS 'Alertas de seguridad del sistema';
COMMENT ON FUNCTION generar_hash_audit() IS 'Genera hash encadenado para verificar integridad';
COMMENT ON FUNCTION prevenir_modificacion_audit() IS 'Garantiza inmutabilidad de registros de auditoría';
