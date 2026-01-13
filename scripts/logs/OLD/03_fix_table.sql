-- Fix: Create logs_auditoria table expected by the backend service
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS logs_auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo_evento VARCHAR(100) NOT NULL,
    usuario_id VARCHAR(255),
    tipo_recurso VARCHAR(100),
    recurso_id VARCHAR(255),
    detalles JSONB,
    ip_origen VARCHAR(50),
    user_agent TEXT,
    fecha_evento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hash_anterior VARCHAR(64),
    hash_actual VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_fecha ON logs_auditoria(fecha_evento DESC);
CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_tipo ON logs_auditoria(tipo_evento);
