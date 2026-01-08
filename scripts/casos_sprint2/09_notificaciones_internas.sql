-- ============================================================================
-- JUEZ SEGURO - Sprint 2
-- Script: Notificaciones Internas del Sistema
-- Propósito: Notificar a jueces sobre nuevas causas, audiencias y reprogramaciones
-- ============================================================================

-- ============================================================================
-- TABLA: notificaciones_internas
-- Propósito: Notificaciones del sistema para funcionarios judiciales
-- ============================================================================
CREATE TABLE IF NOT EXISTS notificaciones_internas (
    notificacion_id SERIAL PRIMARY KEY,
    
    -- Destinatario (funcionario)
    destinatario_id INTEGER NOT NULL,  -- ID del funcionario en db_usuarios
    
    -- Tipo de notificación
    tipo VARCHAR(50) NOT NULL,  -- causa_asignada, audiencia_programada, audiencia_reprogramada
    
    -- Contenido
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT NOT NULL,
    
    -- Referencias opcionales
    causa_id INTEGER REFERENCES causas(causa_id) ON DELETE SET NULL,
    audiencia_id INTEGER REFERENCES audiencias(audiencia_id) ON DELETE SET NULL,
    
    -- Estado
    estado VARCHAR(30) NOT NULL DEFAULT 'no_leida',
    prioridad VARCHAR(20) NOT NULL DEFAULT 'normal',
    
    -- Metadata
    datos_adicionales JSONB,  -- Información extra según el tipo
    
    -- Auditoría
    creado_por_id INTEGER,  -- ID del funcionario que generó la notificación (o NULL si es automática)
    ip_origen VARCHAR(45),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_lectura TIMESTAMPTZ,
    
    -- Restricciones
    CONSTRAINT chk_tipo_notificacion CHECK (tipo IN (
        'causa_asignada',
        'audiencia_programada',
        'audiencia_reprogramada',
        'audiencia_cancelada',
        'documento_agregado',
        'plazo_proximo',
        'sistema'
    )),
    CONSTRAINT chk_estado_notificacion CHECK (estado IN ('no_leida', 'leida', 'archivada')),
    CONSTRAINT chk_prioridad_notificacion CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente'))
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_notif_int_destinatario ON notificaciones_internas(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_notif_int_estado ON notificaciones_internas(estado);
CREATE INDEX IF NOT EXISTS idx_notif_int_tipo ON notificaciones_internas(tipo);
CREATE INDEX IF NOT EXISTS idx_notif_int_causa ON notificaciones_internas(causa_id);
CREATE INDEX IF NOT EXISTS idx_notif_int_audiencia ON notificaciones_internas(audiencia_id);
CREATE INDEX IF NOT EXISTS idx_notif_int_fecha ON notificaciones_internas(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_notif_int_prioridad ON notificaciones_internas(prioridad);

-- Índice compuesto para consulta del juez (mis notificaciones no leídas)
CREATE INDEX IF NOT EXISTS idx_notif_int_dest_estado ON notificaciones_internas(destinatario_id, estado);

-- Comentarios
COMMENT ON TABLE notificaciones_internas IS 'Notificaciones internas del sistema para funcionarios judiciales';
COMMENT ON COLUMN notificaciones_internas.tipo IS 'Tipo: causa_asignada, audiencia_programada, audiencia_reprogramada, etc.';
COMMENT ON COLUMN notificaciones_internas.datos_adicionales IS 'JSON con información extra: número proceso, fecha anterior, fecha nueva, etc.';

-- ============================================================================
-- Verificación
-- ============================================================================
SELECT 'Tabla notificaciones_internas creada correctamente' AS resultado;
\d notificaciones_internas
