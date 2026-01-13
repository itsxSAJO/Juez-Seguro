-- ============================================================================
-- JUEZ SEGURO - Base de Datos de Logs (RESET)
-- Diseñada para la trazabilidad completa y protección contra repudio (FAU)
-- ============================================================================

-- Eliminar tablas existentes
DROP TABLE IF EXISTS logs_auditoria CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS audit_sesiones CASCADE;
DROP TABLE IF EXISTS audit_alertas_seguridad CASCADE;
DROP TABLE IF EXISTS audit_integridad CASCADE;

-- ============================================================================
-- NUEVO ESQUEMA
-- ============================================================================

-- Registro Centralizado de Eventos
CREATE TABLE logs_auditoria (
    log_id BIGSERIAL PRIMARY KEY,
    fecha_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Quién
    usuario_id INT, -- ID Real del actor (Null si es error de login desconocido)
    rol_usuario VARCHAR(50),
    ip_origen VARCHAR(45),
    
    -- Qué
    tipo_evento VARCHAR(50) NOT NULL, -- LOGIN_FALLIDO, CREACION_CAUSA, CAMBIO_ESTADO
    modulo_afectado VARCHAR(50), -- AUTH, CASOS, ADMIN
    
    -- Detalle
    descripcion_evento TEXT,
    datos_afectados JSONB, -- Instantánea de los datos antes/después (si aplica)
    
    -- Integridad
    hash_evento VARCHAR(256) NOT NULL -- Hash SHA-256 del registro para evitar manipulación
);

-- Índices para búsquedas rápidas (Requerimiento HU-CJ-003)
CREATE INDEX idx_logs_fecha ON logs_auditoria(fecha_evento);
CREATE INDEX idx_logs_usuario ON logs_auditoria(usuario_id);
CREATE INDEX idx_logs_tipo ON logs_auditoria(tipo_evento);
CREATE INDEX idx_logs_modulo ON logs_auditoria(modulo_afectado);

-- Verificación
SELECT 'Tablas de logs creadas correctamente' AS resultado;
\dt
