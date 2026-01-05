-- ============================================================================
-- JUEZ SEGURO - Tabla de Documentos (FDP)
-- Almacena metadatos de documentos de expedientes
-- ============================================================================

-- Crear tabla de documentos si no existe
CREATE TABLE IF NOT EXISTS documentos (
    id VARCHAR(50) PRIMARY KEY,
    causa_id INTEGER NOT NULL REFERENCES causas(causa_id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    ruta VARCHAR(500),
    hash_integridad VARCHAR(64),
    tamanio_bytes BIGINT,
    mime_type VARCHAR(100),
    subido_por_id INTEGER,
    fecha_subida TIMESTAMPTZ DEFAULT NOW(),
    estado VARCHAR(30) DEFAULT 'activo',
    descripcion TEXT,
    fecha_eliminacion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_documentos_causa ON documentos(causa_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON documentos(tipo);
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON documentos(estado);

-- ============================================================================
-- DATOS DE PRUEBA (solo desarrollo)
-- ============================================================================
INSERT INTO documentos (id, causa_id, tipo, nombre, descripcion, hash_integridad, tamanio_bytes, mime_type, estado)
VALUES 
  ('doc-001', 1, 'demanda', 'Demanda Inicial.pdf', 'Escrito de demanda presentado por el actor', 'abc123hash', 102400, 'application/pdf', 'activo'),
  ('doc-002', 1, 'providencia', 'Auto de Calificación.pdf', 'Providencia de calificación de demanda', 'def456hash', 51200, 'application/pdf', 'activo'),
  ('doc-003', 2, 'demanda', 'Denuncia Penal.pdf', 'Denuncia presentada ante fiscalía', 'ghi789hash', 204800, 'application/pdf', 'activo')
ON CONFLICT (id) DO NOTHING;

-- Verificación
DO $$
DECLARE
    doc_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO doc_count FROM documentos;
    RAISE NOTICE 'Documentos en la tabla: %', doc_count;
END $$;
