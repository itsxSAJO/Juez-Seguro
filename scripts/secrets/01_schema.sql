-- ============================================================================
-- JUEZ SEGURO - Schema db_secrets
-- Base de Datos de Secretos Criptográficos (FCS - Cryptographic Support)
-- ============================================================================
-- Esta base de datos almacena todos los secretos del sistema encriptados
-- con AES-256-GCM. La clave maestra (MASTER_KEY) se proporciona como
-- variable de entorno y NUNCA se almacena en la base de datos.
-- ============================================================================
-- Common Criteria: FCS_CKM (Cryptographic Key Management)
-- ============================================================================

-- ============================================================================
-- TIPO ENUMERADO: Categorías de secretos
-- ============================================================================
CREATE TYPE tipo_secreto AS ENUM (
    'JWT',           -- Secretos para tokens JWT
    'HMAC',          -- Sales/secretos para HMAC (pseudonimización)
    'AES',           -- Claves de cifrado simétrico
    'PKI',           -- Relacionados con certificados
    'API',           -- API keys externas
    'SMTP',          -- Credenciales de correo
    'OTRO'           -- Otros secretos
);

-- ============================================================================
-- TABLA PRINCIPAL: secretos_sistema
-- Almacena los secretos encriptados con AES-256-GCM
-- ============================================================================
CREATE TABLE secretos_sistema (
    -- Identificación
    secreto_id      SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) UNIQUE NOT NULL,
    tipo            tipo_secreto NOT NULL DEFAULT 'OTRO',
    descripcion     TEXT,
    
    -- Valor encriptado (AES-256-GCM)
    -- El valor se encripta con la MASTER_KEY derivada via PBKDF2
    valor_cifrado   BYTEA NOT NULL,          -- Ciphertext
    iv              BYTEA NOT NULL,          -- Initialization Vector (12 bytes para GCM)
    auth_tag        BYTEA NOT NULL,          -- Authentication Tag (16 bytes)
    
    -- Versionado para rotación de claves
    version         INTEGER NOT NULL DEFAULT 1,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Metadatos de auditoría
    fecha_creacion  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_rotacion  TIMESTAMP WITH TIME ZONE,
    fecha_expiracion TIMESTAMP WITH TIME ZONE,  -- NULL = no expira
    creado_por      VARCHAR(100),
    modificado_por  VARCHAR(100),
    
    -- Restricciones
    CONSTRAINT chk_iv_length CHECK (LENGTH(iv) = 12),
    CONSTRAINT chk_auth_tag_length CHECK (LENGTH(auth_tag) = 16),
    CONSTRAINT chk_version_positive CHECK (version > 0)
);

-- ============================================================================
-- TABLA: historial_rotaciones
-- Registro inmutable de todas las rotaciones de secretos (FAU)
-- ============================================================================
CREATE TABLE historial_rotaciones (
    rotacion_id         SERIAL PRIMARY KEY,
    secreto_id          INTEGER NOT NULL REFERENCES secretos_sistema(secreto_id),
    
    -- Versiones
    version_anterior    INTEGER NOT NULL,
    version_nueva       INTEGER NOT NULL,
    
    -- Auditoría
    fecha_rotacion      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    motivo              VARCHAR(255),
    ip_origen           INET,
    user_agent          TEXT,
    ejecutado_por       VARCHAR(100),
    
    -- Hash de integridad (SHA-256 del registro anterior)
    hash_integridad     VARCHAR(64),
    
    CONSTRAINT chk_version_increment CHECK (version_nueva > version_anterior)
);

-- ============================================================================
-- ÍNDICES
-- ============================================================================
-- Búsqueda rápida de secretos activos por nombre
CREATE INDEX idx_secretos_nombre_activo 
    ON secretos_sistema(nombre) 
    WHERE activo = TRUE;

-- Búsqueda por tipo de secreto
CREATE INDEX idx_secretos_tipo 
    ON secretos_sistema(tipo) 
    WHERE activo = TRUE;

-- Historial por secreto
CREATE INDEX idx_historial_secreto 
    ON historial_rotaciones(secreto_id);

-- Historial por fecha (para auditorías)
CREATE INDEX idx_historial_fecha 
    ON historial_rotaciones(fecha_rotacion DESC);

-- ============================================================================
-- FUNCIONES DE UTILIDAD
-- ============================================================================

-- Función para obtener el último hash de integridad del historial
CREATE OR REPLACE FUNCTION obtener_ultimo_hash_historial()
RETURNS VARCHAR(64) AS $$
DECLARE
    ultimo_hash VARCHAR(64);
BEGIN
    SELECT hash_integridad INTO ultimo_hash
    FROM historial_rotaciones
    ORDER BY rotacion_id DESC
    LIMIT 1;
    
    RETURN COALESCE(ultimo_hash, 'GENESIS');
END;
$$ LANGUAGE plpgsql;

-- Función para registrar rotación con hash encadenado
CREATE OR REPLACE FUNCTION registrar_rotacion(
    p_secreto_id INTEGER,
    p_version_anterior INTEGER,
    p_version_nueva INTEGER,
    p_motivo VARCHAR(255),
    p_ip_origen INET,
    p_user_agent TEXT,
    p_ejecutado_por VARCHAR(100)
) RETURNS INTEGER AS $$
DECLARE
    v_hash_anterior VARCHAR(64);
    v_datos_hash TEXT;
    v_nuevo_hash VARCHAR(64);
    v_rotacion_id INTEGER;
BEGIN
    -- Obtener hash anterior para encadenamiento
    v_hash_anterior := obtener_ultimo_hash_historial();
    
    -- Construir datos para el nuevo hash
    v_datos_hash := CONCAT(
        v_hash_anterior, '|',
        p_secreto_id, '|',
        p_version_anterior, '|',
        p_version_nueva, '|',
        CURRENT_TIMESTAMP, '|',
        p_ejecutado_por
    );
    
    -- Calcular hash SHA-256
    v_nuevo_hash := encode(sha256(v_datos_hash::bytea), 'hex');
    
    -- Insertar registro
    INSERT INTO historial_rotaciones (
        secreto_id,
        version_anterior,
        version_nueva,
        motivo,
        ip_origen,
        user_agent,
        ejecutado_por,
        hash_integridad
    ) VALUES (
        p_secreto_id,
        p_version_anterior,
        p_version_nueva,
        p_motivo,
        p_ip_origen,
        p_user_agent,
        p_ejecutado_por,
        v_nuevo_hash
    ) RETURNING rotacion_id INTO v_rotacion_id;
    
    RETURN v_rotacion_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERMISOS (ejecutar con superusuario si es necesario)
-- ============================================================================
-- En producción, crear un usuario específico con permisos limitados:
-- CREATE USER app_secrets WITH PASSWORD 'xxx';
-- GRANT SELECT, INSERT, UPDATE ON secretos_sistema TO app_secrets;
-- GRANT SELECT, INSERT ON historial_rotaciones TO app_secrets;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_secrets;

-- ============================================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ============================================================================
COMMENT ON TABLE secretos_sistema IS 'Almacén de secretos criptográficos encriptados con AES-256-GCM. FCS_CKM compliant.';
COMMENT ON COLUMN secretos_sistema.valor_cifrado IS 'Valor del secreto encriptado con AES-256-GCM usando MASTER_KEY derivada via PBKDF2';
COMMENT ON COLUMN secretos_sistema.iv IS 'Initialization Vector de 12 bytes para AES-GCM (único por cada encriptación)';
COMMENT ON COLUMN secretos_sistema.auth_tag IS 'Authentication Tag de 16 bytes que garantiza integridad del cifrado';
COMMENT ON TABLE historial_rotaciones IS 'Registro inmutable de rotaciones con hash encadenado para auditoría. FAU compliant.';

-- ============================================================================
-- MENSAJE DE CONFIRMACIÓN
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Schema db_secrets creado correctamente';
    RAISE NOTICE '   - Tabla: secretos_sistema';
    RAISE NOTICE '   - Tabla: historial_rotaciones';
    RAISE NOTICE '   - Funciones de utilidad instaladas';
END $$;
