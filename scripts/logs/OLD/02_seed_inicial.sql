-- ============================================================================
-- JUEZ SEGURO - Registro Inicial de Auditoría
-- ============================================================================

-- Registro génesis del sistema de auditoría
INSERT INTO audit_logs (
    tipo_evento,
    categoria,
    accion,
    usuario_pseudonimo,
    rol_usuario,
    ip_origen,
    recurso_tipo,
    recurso_nombre,
    exitoso,
    codigo_respuesta,
    servidor,
    version_api,
    hash_registro
) VALUES (
    'SISTEMA',
    'CONFIGURACION',
    'INICIALIZACION_SISTEMA',
    'SISTEMA',
    'SISTEMA',
    '127.0.0.1',
    'SISTEMA',
    'Base de datos de auditoría',
    true,
    200,
    'docker-init',
    '1.0.0',
    encode(digest('GENESIS_JUEZ_SEGURO_' || NOW()::TEXT, 'sha256'), 'hex')
);

-- Registrar la creación de las tablas
INSERT INTO audit_logs (
    tipo_evento,
    categoria,
    accion,
    usuario_pseudonimo,
    rol_usuario,
    ip_origen,
    recurso_tipo,
    recurso_nombre,
    datos_despues,
    exitoso,
    codigo_respuesta,
    servidor,
    version_api,
    hash_registro
) VALUES (
    'SISTEMA',
    'CONFIGURACION',
    'CREACION_ESQUEMA_AUDITORIA',
    'SISTEMA',
    'SISTEMA',
    '127.0.0.1',
    'ESQUEMA',
    'db_logs',
    '{
        "tablas_creadas": [
            "audit_logs",
            "audit_sesiones", 
            "audit_accesos_datos",
            "audit_alertas_seguridad",
            "audit_integridad_verificacion"
        ],
        "triggers_creados": [
            "trigger_hash_audit",
            "trigger_inmutabilidad_audit"
        ],
        "vistas_creadas": [
            "v_actividad_usuarios",
            "v_alertas_pendientes"
        ]
    }'::jsonb,
    true,
    200,
    'docker-init',
    '1.0.0',
    encode(digest('SCHEMA_CREATED_' || NOW()::TEXT, 'sha256'), 'hex')
);
