-- ============================================================================
-- JUEZ SEGURO - Datos Iniciales de Roles y Permisos
-- Según Perfil de Protección Common Criteria
-- ============================================================================

-- ============================================================================
-- ROLES DEL SISTEMA
-- Basado en el perfil de protección Common Criteria
-- ============================================================================
INSERT INTO roles (nombre, descripcion, nivel_acceso, permisos) VALUES
    -- CONSEJO DE LA JUDICATURA (CJ)
    -- Administración de cuentas de funcionarios y supervisión de actividad
    ('CJ', 'Consejo de la Judicatura - Administración y Supervisión', 100, '{
        "gestion_usuarios": true,
        "gestion_roles": true,
        "gestion_sistema": true,
        "ver_auditoria": true,
        "exportar_auditoria": true,
        "supervisar_actividad": true,
        "bloquear_cuentas": true,
        "resetear_contrasenas": true
    }'),
    
    -- JUEZ
    -- Gestión de causas asignadas, revisión de expedientes y emisión de decisiones
    ('JUEZ', 'Juez - Gestión de causas y decisiones judiciales', 80, '{
        "ver_causas_asignadas": true,
        "revisar_expedientes": true,
        "emitir_decisiones": true,
        "firmar_documentos": true,
        "programar_audiencias": true,
        "ver_agenda": true,
        "ver_documentos": true,
        "descargar_documentos": true
    }'),
    
    -- SECRETARIO JUDICIAL
    -- Ingreso de causas, gestión documental, audiencias y notificaciones
    ('SECRETARIO', 'Secretario Judicial - Gestión operativa', 60, '{
        "crear_causas": true,
        "editar_causas": true,
        "gestion_documentos": true,
        "subir_documentos": true,
        "programar_audiencias": true,
        "cancelar_audiencias": true,
        "enviar_notificaciones": true,
        "gestionar_notificaciones": true,
        "ver_expedientes": true
    }');

-- NOTA: El CIUDADANO no tiene rol en esta base de datos.
-- Accede al portal público /ciudadano sin autenticación
-- y consulta procesos con datos anonimizados.

-- ============================================================================
-- PERMISOS GRANULARES DEL SISTEMA
-- ============================================================================
INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
    -- Módulo de Usuarios
    ('USER_CREATE', 'Crear usuarios', 'Permite crear nuevos usuarios en el sistema', 'usuarios'),
    ('USER_READ', 'Ver usuarios', 'Permite ver información de usuarios', 'usuarios'),
    ('USER_UPDATE', 'Modificar usuarios', 'Permite modificar datos de usuarios', 'usuarios'),
    ('USER_DELETE', 'Eliminar usuarios', 'Permite desactivar usuarios', 'usuarios'),
    ('USER_RESET_PASSWORD', 'Resetear contraseñas', 'Permite resetear contraseñas de usuarios', 'usuarios'),
    
    -- Módulo de Casos
    ('CASE_CREATE', 'Crear causas', 'Permite crear nuevas causas judiciales', 'casos'),
    ('CASE_READ', 'Ver causas', 'Permite ver información de causas', 'casos'),
    ('CASE_UPDATE', 'Modificar causas', 'Permite modificar datos de causas', 'casos'),
    ('CASE_DELETE', 'Archivar causas', 'Permite archivar causas', 'casos'),
    ('CASE_ASSIGN', 'Asignar causas', 'Permite asignar causas a jueces', 'casos'),
    
    -- Módulo de Documentos
    ('DOC_UPLOAD', 'Subir documentos', 'Permite subir documentos a expedientes', 'documentos'),
    ('DOC_DOWNLOAD', 'Descargar documentos', 'Permite descargar documentos', 'documentos'),
    ('DOC_SIGN', 'Firmar documentos', 'Permite firmar documentos digitalmente', 'documentos'),
    
    -- Módulo de Audiencias
    ('AUD_SCHEDULE', 'Programar audiencias', 'Permite programar audiencias', 'audiencias'),
    ('AUD_CANCEL', 'Cancelar audiencias', 'Permite cancelar audiencias', 'audiencias'),
    ('AUD_RESCHEDULE', 'Reprogramar audiencias', 'Permite reprogramar audiencias', 'audiencias'),
    
    -- Módulo de Auditoría
    ('AUDIT_READ', 'Ver auditoría', 'Permite ver logs de auditoría', 'auditoria'),
    ('AUDIT_EXPORT', 'Exportar auditoría', 'Permite exportar reportes de auditoría', 'auditoria'),
    
    -- Módulo de Notificaciones
    ('NOTIF_SEND', 'Enviar notificaciones', 'Permite enviar notificaciones', 'notificaciones'),
    ('NOTIF_READ', 'Ver notificaciones', 'Permite ver notificaciones', 'notificaciones');

-- ============================================================================
-- ASIGNACIÓN DE PERMISOS A ROLES
-- ============================================================================

-- Permisos del CJ (todos - incluye auditoría)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre = 'CJ';

-- Permisos del Juez
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre = 'JUEZ'
AND p.codigo IN ('CASE_READ', 'CASE_UPDATE', 'DOC_DOWNLOAD', 'DOC_SIGN', 'AUD_SCHEDULE', 'AUD_RESCHEDULE', 'NOTIF_READ');

-- Permisos del Secretario
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre = 'SECRETARIO'
AND p.codigo IN ('CASE_CREATE', 'CASE_READ', 'CASE_UPDATE', 'DOC_UPLOAD', 'DOC_DOWNLOAD', 'AUD_SCHEDULE', 'AUD_CANCEL', 'AUD_RESCHEDULE', 'NOTIF_SEND', 'NOTIF_READ');
