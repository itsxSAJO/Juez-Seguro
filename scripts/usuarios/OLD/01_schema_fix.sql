-- ============================================================================
-- JUEZ SEGURO - Base de Datos de Usuarios
-- Cumple con FIA_UID (Identificación), FIA_ATD (Atributos) y FIA_AFL (Bloqueo)
-- ============================================================================

-- Tabla de Roles (Permisos fijos)
CREATE TABLE IF NOT EXISTS roles (
    rol_id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL, -- 'ADMIN_CJ', 'JUEZ', 'SECRETARIO'
    descripcion VARCHAR(150)
);

-- Tabla Principal de Funcionarios
CREATE TABLE IF NOT EXISTS funcionarios (
    funcionario_id SERIAL PRIMARY KEY,
    identificacion VARCHAR(20) UNIQUE NOT NULL, -- Cédula/ID único
    nombres_completos VARCHAR(200) NOT NULL,
    correo_institucional VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- Almacenar solo HASH (Argon2/BCrypt)
    
    -- Atributos de Seguridad (FIA_ATD) 
    rol_id INT NOT NULL REFERENCES roles(rol_id),
    unidad_judicial VARCHAR(100) NOT NULL, 
    materia VARCHAR(100) NOT NULL, 
    
    -- Control de Acceso y Bloqueo (FIA_AFL)
    estado VARCHAR(20) DEFAULT 'HABILITABLE' CHECK (estado IN ('HABILITABLE', 'ACTIVA', 'SUSPENDIDA', 'INACTIVA', 'BLOQUEADA')),
    intentos_fallidos INT DEFAULT 0,
    fecha_bloqueo TIMESTAMP NULL,
    
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historial de Cambios de Estado (Para auditoría interna de cuentas)
CREATE TABLE IF NOT EXISTS historial_estados (
    historial_id SERIAL PRIMARY KEY,
    funcionario_id INT REFERENCES funcionarios(funcionario_id),
    estado_anterior VARCHAR(20),
    estado_nuevo VARCHAR(20),
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_modificador_id INT -- ID del Admin CJ que hizo el cambio
);

-- Datos semilla iniciales
INSERT INTO roles (nombre, descripcion) VALUES 
('ADMIN_CJ', 'Administrador del Consejo de la Judicatura'),
('JUEZ', 'Juez titular'),
('SECRETARIO', 'Secretario Judicial')
ON CONFLICT (nombre) DO NOTHING;
