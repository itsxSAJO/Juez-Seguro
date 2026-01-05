-- ============================================================================
-- JUEZ SEGURO - Usuarios de Prueba (Desarrollo)
-- ============================================================================
-- ADVERTENCIA: Este archivo es SOLO para desarrollo y testing.
-- NO usar en producción.
-- ============================================================================
-- Contraseñas según Common Criteria:
-- - Mínimo 16 caracteres
-- - Mayúsculas, minúsculas, números y símbolos especiales
-- - Sin palabras completas de diccionario
-- ============================================================================

-- ============================================================================
-- USUARIOS DE PRUEBA
-- ============================================================================
-- | Rol        | Usuario                              | Contraseña              |
-- |------------|--------------------------------------|-------------------------|
-- | ADMIN_CJ   | admin.cj@judicatura.gob.ec           | JzAdm1n_CJ2026Seguro!   |
-- | JUEZ       | juez.gutierrez@judicatura.gob.ec     | JzJuez_T1tular2026Sec!  |
-- | SECRETARIO | secretario.paredes@judicatura.gob.ec | JzSecr3t_Jud2026Seg!    |
-- ============================================================================

INSERT INTO funcionarios (
    identificacion, 
    nombres_completos, 
    correo_institucional, 
    password_hash, 
    rol_id, 
    unidad_judicial, 
    materia, 
    estado
) VALUES 
    -- ADMIN_CJ - Administrador del Consejo de la Judicatura
    -- Contraseña: JzAdm1n_CJ2026Seguro!
    (
        '1700000001', 
        'Carlos Alberto Mendoza Rivera', 
        'admin.cj@judicatura.gob.ec', 
        '$2a$12$SpGeJZ9LW9Dkk9YDmwvKMu5Zj/9g1R2FCl3D1tf4NZf/Ogwdpv/NC', 
        1, 
        'Consejo de la Judicatura', 
        'Administración', 
        'ACTIVA'
    ),
    -- JUEZ - Juez Titular
    -- Contraseña: JzJuez_T1tular2026Sec!
    (
        '1700000002', 
        'María Elena Gutiérrez Salas', 
        'juez.gutierrez@judicatura.gob.ec', 
        '$2a$12$wio9ab.9JHhAJaj0PXz1qeHR60x8QjYaEeS1y5JuJzO5FaTLrFdl6', 
        2, 
        'Unidad Judicial Civil Quito Norte', 
        'Civil', 
        'ACTIVA'
    ),
    -- SECRETARIO - Secretario Judicial
    -- Contraseña: JzSecr3t_Jud2026Seg!
    (
        '1700000003', 
        'Ana Lucía Paredes Villagómez', 
        'secretario.paredes@judicatura.gob.ec', 
        '$2a$12$Ak3dgV3mB7CLKlBIcXtA3ed0TrCwmo5MiOU0bofNb3FNpswgGts0O', 
        3, 
        'Unidad Judicial Civil Quito Norte', 
        'Civil', 
        'ACTIVA'
    )
ON CONFLICT (identificacion) DO NOTHING;

-- Verificación de inserción
DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM funcionarios;
    RAISE NOTICE 'Usuarios de prueba insertados. Total funcionarios: %', user_count;
END $$;
