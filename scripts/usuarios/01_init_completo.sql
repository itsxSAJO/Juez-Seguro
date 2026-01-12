-- ============================================================================
-- JUEZ SEGURO - Base de Datos de Usuarios (FIA)
-- Script Consolidado de Inicialización
-- ============================================================================
-- Common Criteria: FIA (Identification and Authentication)
-- Este script crea todo el esquema necesario para la gestión de usuarios
-- ============================================================================
-- Ejecutar en: db_usuarios (puerto 5435)
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLA: roles
-- Propósito: Definición de roles del sistema según perfil de protección
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
    rol_id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas por nombre
CREATE INDEX IF NOT EXISTS idx_roles_nombre ON roles(nombre);

COMMENT ON TABLE roles IS 'Roles del sistema judicial según Common Criteria';

-- ============================================================================
-- TABLA: funcionarios
-- Propósito: Almacenamiento de funcionarios judiciales (jueces, secretarios, admin)
-- ============================================================================
CREATE TABLE IF NOT EXISTS funcionarios (
    funcionario_id SERIAL PRIMARY KEY,
    
    -- Identificación
    identificacion VARCHAR(20) NOT NULL UNIQUE,
    nombres_completos VARCHAR(200) NOT NULL,
    correo_institucional VARCHAR(255) NOT NULL UNIQUE,
    
    -- Autenticación
    password_hash VARCHAR(255) NOT NULL,
    
    -- Rol y ubicación
    rol_id INTEGER NOT NULL REFERENCES roles(rol_id),
    unidad_judicial VARCHAR(200),
    materia VARCHAR(100),
    
    -- Estado de la cuenta
    estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVA',
    intentos_fallidos INTEGER DEFAULT 0,
    fecha_bloqueo TIMESTAMPTZ,
    
    -- Auditoría
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    ultimo_login TIMESTAMPTZ,
    
    -- Restricciones
    CONSTRAINT chk_estado_funcionario CHECK (estado IN ('ACTIVA', 'INACTIVA', 'BLOQUEADA', 'SUSPENDIDA')),
    CONSTRAINT chk_intentos_fallidos CHECK (intentos_fallidos >= 0 AND intentos_fallidos <= 10)
);

-- Índices optimizados
CREATE INDEX IF NOT EXISTS idx_funcionarios_identificacion ON funcionarios(identificacion);
CREATE INDEX IF NOT EXISTS idx_funcionarios_correo ON funcionarios(correo_institucional);
CREATE INDEX IF NOT EXISTS idx_funcionarios_rol ON funcionarios(rol_id);
CREATE INDEX IF NOT EXISTS idx_funcionarios_estado ON funcionarios(estado);
CREATE INDEX IF NOT EXISTS idx_funcionarios_unidad ON funcionarios(unidad_judicial);

COMMENT ON TABLE funcionarios IS 'Funcionarios judiciales del sistema (jueces, secretarios, administradores)';

-- ============================================================================
-- TABLA: historial_estados
-- Propósito: Historial de cambios de estado de funcionarios
-- ============================================================================
CREATE TABLE IF NOT EXISTS historial_estados (
    historial_id SERIAL PRIMARY KEY,
    funcionario_id INTEGER NOT NULL REFERENCES funcionarios(funcionario_id),
    estado_anterior VARCHAR(30),
    estado_nuevo VARCHAR(30) NOT NULL,
    motivo TEXT,
    modificado_por_id INTEGER,
    fecha_cambio TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_funcionario ON historial_estados(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_estados(fecha_cambio);

COMMENT ON TABLE historial_estados IS 'Auditoría de cambios de estado de cuentas de funcionarios';

-- ============================================================================
-- TABLA: sesiones_activas
-- Propósito: Control de sesiones concurrentes (FIA_USB)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sesiones_activas (
    sesion_id SERIAL PRIMARY KEY,
    funcionario_id INTEGER NOT NULL REFERENCES funcionarios(funcionario_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    
    -- Control de tiempo
    inicio_sesion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiracion TIMESTAMPTZ NOT NULL,
    
    -- Estado
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    cerrada_por VARCHAR(50)  -- 'usuario', 'timeout', 'admin', 'sistema'
);

CREATE INDEX IF NOT EXISTS idx_sesiones_funcionario ON sesiones_activas(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones_activas(token_hash);
CREATE INDEX IF NOT EXISTS idx_sesiones_activas ON sesiones_activas(activa) WHERE activa = TRUE;
CREATE INDEX IF NOT EXISTS idx_sesiones_expiracion ON sesiones_activas(expiracion);

COMMENT ON TABLE sesiones_activas IS 'Control de sesiones activas para prevenir accesos concurrentes no autorizados';

-- ============================================================================
-- FUNCIÓN: Actualizar timestamp de modificación
-- ============================================================================
CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para funcionarios
DROP TRIGGER IF EXISTS trigger_actualizar_fecha_funcionarios ON funcionarios;
CREATE TRIGGER trigger_actualizar_fecha_funcionarios
    BEFORE UPDATE ON funcionarios
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

-- ============================================================================
-- DATOS INICIALES: Roles del Sistema
-- ============================================================================
INSERT INTO roles (nombre, descripcion) VALUES
    ('ADMIN_CJ', 'Consejo de la Judicatura - Administración y Supervisión del Sistema'),
    ('JUEZ', 'Juez - Gestión de causas asignadas y emisión de decisiones judiciales'),
    ('SECRETARIO', 'Secretario Judicial - Gestión operativa de causas, documentos y audiencias')
ON CONFLICT (nombre) DO NOTHING;

-- ============================================================================
-- DATOS DE DESARROLLO (Solo si no existen usuarios)
-- ============================================================================
-- Nota: Los usuarios se crean con el script TypeScript: npm run db:seed-users-dev
-- El hash de contraseña se genera dinámicamente para evitar CWE-798
-- Contraseña de desarrollo: Dev2026!Secure#Pass

-- Verificación de creación
DO $$
BEGIN
    RAISE NOTICE 'Schema de usuarios creado correctamente';
    RAISE NOTICE 'Roles insertados: %', (SELECT COUNT(*) FROM roles);
    RAISE NOTICE 'Para crear usuarios de desarrollo, ejecutar: npm run db:seed-users-dev';
END $$;

-- Mostrar tablas creadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('roles', 'funcionarios', 'historial_estados', 'sesiones_activas');
