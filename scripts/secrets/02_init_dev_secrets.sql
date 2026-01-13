-- ============================================================================
-- JUEZ SEGURO - Inicialización de Secretos de Desarrollo
-- ============================================================================
-- ADVERTENCIA: Este script es SOLO para entornos de desarrollo.
-- En producción, los secretos deben generarse dinámicamente.
-- ============================================================================
-- Ejecutar DESPUÉS de 01_schema.sql
-- Requiere variable de entorno MASTER_KEY configurada
-- ============================================================================

-- Los secretos reales se insertan desde el backend usando el SecretsService
-- que encripta los valores con AES-256-GCM antes de guardarlos.

-- Esta lista documenta los secretos que el sistema necesita:
-- 
-- 1. JWT_SECRET (tipo: JWT)
--    Secreto para firmar tokens JWT de autenticación.
--    Se genera automáticamente si no existe.
--
-- 2. HMAC_SALT (tipo: HMAC)
--    Salt para la generación de pseudónimos de jueces.
--    Crítico para la anonimización consistente.
--
-- 3. PFX_PASSWORD (tipo: PKI)
--    Contraseña para desbloquear certificados PFX de jueces.
--    Requerido para firma digital de decisiones.
--
-- 4. DOCS_ENCRYPTION_KEY (tipo: AES)
--    Clave para cifrar documentos almacenados.
--    Protege documentos judiciales en reposo.
--
-- 5. DATA_ENCRYPTION_KEY (tipo: AES) [NUEVO]
--    Clave para cifrar datos sensibles de funcionarios.
--    Utilizada para cifrar identificacion y nombres_completos
--    en la base de datos de usuarios con AES-256-GCM.
--
-- 6. SMTP_USER (tipo: SMTP)
--    Usuario para envío de correos (notificaciones, OTP).
--
-- 7. SMTP_PASSWORD (tipo: SMTP)
--    Contraseña del servicio SMTP.

-- ============================================================================
-- VERIFICACIÓN DE SECRETOS REQUERIDOS
-- ============================================================================
DO $$
DECLARE
    v_count INTEGER;
    v_secretos_requeridos TEXT[] := ARRAY[
        'JWT_SECRET',
        'HMAC_SALT', 
        'PFX_PASSWORD',
        'DOCS_ENCRYPTION_KEY',
        'DATA_ENCRYPTION_KEY',
        'SMTP_USER',
        'SMTP_PASSWORD'
    ];
    v_secretos_descripciones TEXT[] := ARRAY[
        'Secreto para tokens JWT',
        'Salt para pseudónimos de jueces',
        'Contraseña certificados PFX',
        'Clave para cifrar documentos',
        'Clave para cifrar datos de funcionarios (identificación, nombres)',
        'Usuario SMTP para correos',
        'Contraseña SMTP (App Password)'
    ];
    v_secreto TEXT;
    v_idx INTEGER := 1;
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Verificación de Secretos del Sistema';
    RAISE NOTICE '============================================';
    
    FOREACH v_secreto IN ARRAY v_secretos_requeridos
    LOOP
        SELECT COUNT(*) INTO v_count 
        FROM secretos_sistema 
        WHERE nombre = v_secreto AND activo = TRUE;
        
        IF v_count > 0 THEN
            RAISE NOTICE '✅ %: Configurado', v_secreto;
        ELSE
            RAISE NOTICE '❌ %: NO CONFIGURADO', v_secreto;
        END IF;
    END LOOP;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Los secretos faltantes se configuran desde:';
    RAISE NOTICE '  backend/src/services/secrets.service.ts';
    RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- DOCUMENTACIÓN DE CIFRADO DE DATOS DE USUARIO
-- ============================================================================
COMMENT ON DATABASE db_secrets IS 
'Base de datos de secretos criptográficos del sistema Juez Seguro.
Incluye DATA_ENCRYPTION_KEY para cifrar datos sensibles de funcionarios.

CAMPOS CIFRADOS EN db_usuarios.funcionarios:
- identificacion (VARCHAR 500): Cédula cifrada con AES-256-GCM
- nombres_completos (VARCHAR 500): Nombre completo cifrado con AES-256-GCM

ALGORITMO: AES-256-GCM con PBKDF2 (100,000 iteraciones) para derivación de clave.
El correo_institucional NO está cifrado para permitir búsquedas en login.';
