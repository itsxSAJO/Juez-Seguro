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

-- Índices para optimización
CREATE INDEX idx_causas_numero ON causas(numero_proceso);
CREATE INDEX idx_causas_juez ON causas(juez_asignado_id);
CREATE INDEX idx_causas_estado ON causas(estado_procesal);
CREATE INDEX idx_causas_materia ON causas(materia);
CREATE INDEX idx_mapa_juez ON mapa_pseudonimos(juez_id_real);
CREATE INDEX idx_mapa_pseudo ON mapa_pseudonimos(pseudonimo_publico);
CREATE INDEX idx_expedientes_causa ON expedientes(causa_id);

-- Verificación
SELECT 'Tablas de casos creadas correctamente' AS resultado;
\dt
