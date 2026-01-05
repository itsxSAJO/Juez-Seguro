-- ============================================================================
-- JUEZ SEGURO - Base de Datos de Usuarios (FIA)
-- Esquema de Identidad y Gestión de Acceso
-- ============================================================================
-- Common Criteria: FIA (Identification and Authentication)
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLA: roles
-- Propósito: Definición de roles del sistema según perfil de protección
-- ============================================================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    nivel_acceso INTEGER NOT NULL DEFAULT 0,
    permisos JSONB NOT NULL DEFAULT '{}',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas por nombre
CREATE INDEX idx_roles_nombre ON roles(nombre);

-- ============================================================================
-- TABLA: usuarios
-- Propósito: Almacenamiento seguro de credenciales de usuarios
-- ============================================================================
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cedula VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    rol_id UUID NOT NULL REFERENCES roles(id),
    
    -- Atributos de seguridad (FIA_ATD)
    activo BOOLEAN NOT NULL DEFAULT true,
    bloqueado BOOLEAN NOT NULL DEFAULT false,
    intentos_fallidos INTEGER NOT NULL DEFAULT 0,
    ultimo_intento_fallido TIMESTAMPTZ,
    
    -- Control de sesiones
    ultimo_login TIMESTAMPTZ,
    token_recuperacion VARCHAR(255),
    token_expiracion TIMESTAMPTZ,
    
    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    
    -- Restricciones
    CONSTRAINT chk_intentos_fallidos CHECK (intentos_fallidos >= 0 AND intentos_fallidos <= 10)
);

-- Índices para optimización de consultas
CREATE INDEX idx_usuarios_cedula ON usuarios(cedula);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol_id);
CREATE INDEX idx_usuarios_activo ON usuarios(activo) WHERE activo = true;

-- ============================================================================
-- TABLA: sesiones_activas
-- Propósito: Control de sesiones concurrentes (FIA_USB)
-- ============================================================================
CREATE TABLE sesiones_activas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET NOT NULL,
    user_agent TEXT,
    dispositivo VARCHAR(100),
    
    -- Control de tiempo
    inicio_sesion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiracion TIMESTAMPTZ NOT NULL,
    
    -- Estado
    activa BOOLEAN NOT NULL DEFAULT true,
    cerrada_por VARCHAR(50), -- 'usuario', 'timeout', 'admin', 'sistema'
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para gestión de sesiones
CREATE INDEX idx_sesiones_usuario ON sesiones_activas(usuario_id);
CREATE INDEX idx_sesiones_token ON sesiones_activas(token_hash);
CREATE INDEX idx_sesiones_activas ON sesiones_activas(activa) WHERE activa = true;
CREATE INDEX idx_sesiones_expiracion ON sesiones_activas(expiracion);

-- ============================================================================
-- TABLA: permisos
-- Propósito: Definición granular de permisos del sistema
-- ============================================================================
CREATE TABLE permisos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(100) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    modulo VARCHAR(50) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA: roles_permisos
-- Propósito: Relación muchos a muchos entre roles y permisos
-- ============================================================================
CREATE TABLE roles_permisos (
    rol_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    otorgado_por UUID REFERENCES usuarios(id),
    otorgado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (rol_id, permiso_id)
);

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

-- Triggers para actualización automática
CREATE TRIGGER update_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ============================================================================
COMMENT ON TABLE usuarios IS 'Almacena credenciales y atributos de seguridad de usuarios del sistema judicial';
COMMENT ON TABLE roles IS 'Define los roles del sistema con sus niveles de acceso';
COMMENT ON TABLE sesiones_activas IS 'Control de sesiones activas para prevenir acceso no autorizado';
COMMENT ON TABLE permisos IS 'Catálogo de permisos granulares del sistema';
