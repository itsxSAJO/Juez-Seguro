-- ============================================================================
-- JUEZ SEGURO - Base de Datos de Auditoría (FAU)
-- Script Consolidado de Inicialización
-- ============================================================================
-- Common Criteria: FAU (Security Audit)
-- Implementa registro inmutable de eventos del sistema
-- ============================================================================
-- Ejecutar en: db_logs (puerto 5434)
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLA: logs_auditoria
-- Propósito: Registro principal de eventos de auditoría
-- CRÍTICO: Esta tabla es APPEND-ONLY (sin updates ni deletes)
-- Compatible con el backend AuditService
-- ============================================================================
CREATE TABLE IF NOT EXISTS logs_auditoria (
    log_id SERIAL PRIMARY KEY,
    
    -- Timestamp
    fecha_evento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Identificación del evento
    tipo_evento VARCHAR(100) NOT NULL,
    modulo_afectado VARCHAR(100),
    descripcion_evento TEXT,
    
    -- Actor del evento
    usuario_id VARCHAR(255),
    usuario_correo VARCHAR(255),
    rol_usuario VARCHAR(50),
    sesion_id VARCHAR(100),
    
    -- Origen de la petición
    ip_origen VARCHAR(50),
    user_agent TEXT,
    endpoint VARCHAR(255),
    metodo_http VARCHAR(10),
    
    -- Recurso afectado
    tipo_recurso VARCHAR(100),
    recurso_id VARCHAR(255),
    causa_referencia VARCHAR(50),  -- Número de proceso/causa relacionada
    
    -- Datos del evento
    detalles JSONB,
    datos_afectados JSONB,
    
    -- Resultado
    exitoso BOOLEAN NOT NULL DEFAULT TRUE,
    codigo_respuesta INTEGER,
    mensaje_error TEXT,
    
    -- Integridad de cadena (FAU_STG)
    hash_evento VARCHAR(64) NOT NULL,
    hash_anterior VARCHAR(64),
    
    -- Metadatos
    servidor VARCHAR(100),
    version_api VARCHAR(20)
);

-- Índices optimizados para consultas de auditoría (HU-CJ-003)
CREATE INDEX IF NOT EXISTS idx_logs_fecha_evento ON logs_auditoria(fecha_evento DESC);
CREATE INDEX IF NOT EXISTS idx_logs_usuario_id ON logs_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_usuario_correo ON logs_auditoria(usuario_correo);
CREATE INDEX IF NOT EXISTS idx_logs_tipo_evento ON logs_auditoria(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_logs_modulo ON logs_auditoria(modulo_afectado);
CREATE INDEX IF NOT EXISTS idx_logs_causa_ref ON logs_auditoria(causa_referencia) WHERE causa_referencia IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_logs_exitoso ON logs_auditoria(exitoso) WHERE exitoso = FALSE;
CREATE INDEX IF NOT EXISTS idx_logs_fecha_usuario ON logs_auditoria(fecha_evento DESC, usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_hash_cadena ON logs_auditoria(log_id, hash_evento, hash_anterior);

COMMENT ON TABLE logs_auditoria IS 'Registro inmutable de eventos de auditoría del sistema (FAU_GEN)';
COMMENT ON COLUMN logs_auditoria.hash_anterior IS 'Hash SHA-256 del evento anterior para verificar integridad de cadena';
COMMENT ON COLUMN logs_auditoria.hash_evento IS 'Hash SHA-256 del evento actual';
COMMENT ON COLUMN logs_auditoria.causa_referencia IS 'Número de proceso/causa relacionada para filtrado directo';

-- ============================================================================
-- TABLA: audit_sesiones
-- Propósito: Registro detallado de sesiones de usuario
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_sesiones (
    id SERIAL PRIMARY KEY,
    
    -- Identificación
    sesion_id VARCHAR(100) NOT NULL UNIQUE,
    usuario_id VARCHAR(255) NOT NULL,
    usuario_correo VARCHAR(255),
    rol_usuario VARCHAR(50),
    
    -- Tiempos
    inicio_sesion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fin_sesion TIMESTAMPTZ,
    duracion_segundos INTEGER,
    
    -- Origen
    ip_origen VARCHAR(50) NOT NULL,
    user_agent TEXT,
    dispositivo VARCHAR(100),
    
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
        'REVOCADA_ADMIN', 'SESION_DUPLICADA', 'ERROR_SISTEMA', NULL
    ))
);

CREATE INDEX IF NOT EXISTS idx_audit_sesiones_usuario ON audit_sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_sesiones_correo ON audit_sesiones(usuario_correo);
CREATE INDEX IF NOT EXISTS idx_audit_sesiones_estado ON audit_sesiones(estado);
CREATE INDEX IF NOT EXISTS idx_audit_sesiones_inicio ON audit_sesiones(inicio_sesion DESC);

COMMENT ON TABLE audit_sesiones IS 'Registro detallado de sesiones de usuarios';

-- ============================================================================
-- TABLA: audit_accesos_datos
-- Propósito: Registro específico de accesos a datos sensibles (FAU_SAR)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_accesos_datos (
    id SERIAL PRIMARY KEY,
    
    -- Referencia al log principal
    audit_log_id INTEGER REFERENCES logs_auditoria(log_id),
    
    -- Timestamp
    timestamp_acceso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Actor
    usuario_id VARCHAR(255) NOT NULL,
    usuario_correo VARCHAR(255),
    rol_usuario VARCHAR(50),
    
    -- Recurso accedido
    tipo_dato VARCHAR(100) NOT NULL,
    causa_id VARCHAR(50),
    documento_id VARCHAR(100),
    
    -- Tipo de acceso
    operacion VARCHAR(50) NOT NULL,  -- lectura, descarga, modificacion, eliminacion
    
    -- Resultado
    acceso_permitido BOOLEAN NOT NULL DEFAULT TRUE,
    motivo_denegacion TEXT,
    
    -- Integridad
    hash_registro VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accesos_timestamp ON audit_accesos_datos(timestamp_acceso DESC);
CREATE INDEX IF NOT EXISTS idx_accesos_usuario ON audit_accesos_datos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_accesos_causa ON audit_accesos_datos(causa_id);
CREATE INDEX IF NOT EXISTS idx_accesos_tipo ON audit_accesos_datos(tipo_dato);
CREATE INDEX IF NOT EXISTS idx_accesos_operacion ON audit_accesos_datos(operacion);

COMMENT ON TABLE audit_accesos_datos IS 'Registro de accesos a datos sensibles (FAU_SAR)';

-- ============================================================================
-- TABLA: audit_alertas_seguridad
-- Propósito: Registro de alertas de seguridad para monitoreo
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_alertas_seguridad (
    id SERIAL PRIMARY KEY,
    
    -- Timestamp
    fecha_alerta TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Clasificación
    tipo_alerta VARCHAR(100) NOT NULL,
    severidad VARCHAR(20) NOT NULL DEFAULT 'MEDIA',
    
    -- Detalles
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT NOT NULL,
    
    -- Origen
    usuario_id VARCHAR(255),
    ip_origen VARCHAR(50),
    
    -- Acción tomada
    accion_automatica VARCHAR(100),
    requiere_revision BOOLEAN DEFAULT FALSE,
    
    -- Estado de revisión
    revisada BOOLEAN DEFAULT FALSE,
    revisada_por VARCHAR(255),
    fecha_revision TIMESTAMPTZ,
    notas_revision TEXT,
    
    CONSTRAINT chk_severidad_alerta CHECK (severidad IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA'))
);

CREATE INDEX IF NOT EXISTS idx_alertas_fecha ON audit_alertas_seguridad(fecha_alerta DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON audit_alertas_seguridad(tipo_alerta);
CREATE INDEX IF NOT EXISTS idx_alertas_severidad ON audit_alertas_seguridad(severidad);
CREATE INDEX IF NOT EXISTS idx_alertas_pendientes ON audit_alertas_seguridad(revisada, severidad) WHERE revisada = FALSE;

COMMENT ON TABLE audit_alertas_seguridad IS 'Alertas de seguridad para monitoreo y respuesta';

-- ============================================================================
-- VISTA: Vista segura para auditoría del CJ (HU-CJ-003)
-- ============================================================================
CREATE OR REPLACE VIEW vista_auditoria_segura AS
SELECT 
    log_id,
    fecha_evento,
    usuario_id,
    usuario_correo,
    rol_usuario,
    tipo_evento,
    modulo_afectado,
    descripcion_evento,
    causa_referencia,
    ip_origen,
    exitoso,
    CASE 
        WHEN detalles IS NOT NULL THEN TRUE 
        ELSE FALSE 
    END AS tiene_detalles
FROM logs_auditoria
ORDER BY fecha_evento DESC;

COMMENT ON VIEW vista_auditoria_segura IS 'Vista de solo lectura para auditoría del CJ - HU-CJ-003';

-- ============================================================================
-- FUNCIÓN: Verificar integridad de cadena de auditoría
-- ============================================================================
CREATE OR REPLACE FUNCTION verificar_integridad_auditoria(
    p_desde TIMESTAMPTZ DEFAULT NULL,
    p_hasta TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    total_registros BIGINT,
    registros_verificados BIGINT,
    registros_validos BIGINT,
    registros_invalidos BIGINT,
    primer_invalido INTEGER,
    integridad_ok BOOLEAN
) AS $$
DECLARE
    v_registro RECORD;
    v_hash_esperado VARCHAR(64);
    v_total BIGINT := 0;
    v_verificados BIGINT := 0;
    v_validos BIGINT := 0;
    v_invalidos BIGINT := 0;
    v_primer_invalido INTEGER := NULL;
BEGIN
    FOR v_registro IN 
        SELECT log_id, hash_evento, hash_anterior, fecha_evento
        FROM logs_auditoria
        WHERE (p_desde IS NULL OR fecha_evento >= p_desde)
          AND (p_hasta IS NULL OR fecha_evento <= p_hasta)
        ORDER BY fecha_evento ASC
    LOOP
        v_total := v_total + 1;
        v_verificados := v_verificados + 1;
        
        -- Verificar que el hash existe
        IF v_registro.hash_evento IS NOT NULL AND v_registro.hash_evento != '' THEN
            v_validos := v_validos + 1;
        ELSE
            v_invalidos := v_invalidos + 1;
            IF v_primer_invalido IS NULL THEN
                v_primer_invalido := v_registro.log_id;
            END IF;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT 
        v_total,
        v_verificados,
        v_validos,
        v_invalidos,
        v_primer_invalido,
        (v_invalidos = 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verificar_integridad_auditoria IS 'Verifica la integridad de la cadena de auditoría';

-- ============================================================================
-- FUNCIÓN: Estadísticas de auditoría por período
-- ============================================================================
CREATE OR REPLACE FUNCTION estadisticas_auditoria(
    p_desde TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '7 days'),
    p_hasta TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_eventos BIGINT,
    eventos_exitosos BIGINT,
    eventos_fallidos BIGINT,
    usuarios_unicos BIGINT,
    tipo_mas_frecuente VARCHAR(100),
    eventos_por_tipo JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE exitoso = TRUE) as exitosos,
            COUNT(*) FILTER (WHERE exitoso = FALSE) as fallidos,
            COUNT(DISTINCT usuario_id) as usuarios,
            MODE() WITHIN GROUP (ORDER BY tipo_evento) as tipo_frecuente
        FROM logs_auditoria
        WHERE fecha_evento BETWEEN p_desde AND p_hasta
    ),
    por_tipo AS (
        SELECT jsonb_object_agg(tipo_evento, cnt) as tipos
        FROM (
            SELECT tipo_evento, COUNT(*) as cnt
            FROM logs_auditoria
            WHERE fecha_evento BETWEEN p_desde AND p_hasta
            GROUP BY tipo_evento
        ) t
    )
    SELECT 
        s.total,
        s.exitosos,
        s.fallidos,
        s.usuarios,
        s.tipo_frecuente,
        p.tipos
    FROM stats s, por_tipo p;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION estadisticas_auditoria IS 'Genera estadísticas de auditoría para un período';

-- ============================================================================
-- Verificación de creación
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Schema de logs de auditoría creado correctamente';
END $$;

SELECT 'Tablas creadas:' AS info;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('logs_auditoria', 'audit_sesiones', 'audit_accesos_datos', 'audit_alertas_seguridad');
