-- ============================================================================
-- JUEZ SEGURO - Base de Datos de Casos (FDP)
-- Script Consolidado de Inicialización
-- ============================================================================
-- Common Criteria: FDP (User Data Protection)
-- Implementa pseudonimización para protección de datos sensibles
-- ============================================================================
-- Ejecutar en: db_casos (puerto 5433)
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLA: causas
-- Propósito: Registro principal de causas judiciales
-- NOTA: Usa pseudónimos para funcionarios, nombres reales para partes procesales
-- ============================================================================
CREATE TABLE IF NOT EXISTS causas (
    causa_id SERIAL PRIMARY KEY,
    numero_proceso VARCHAR(50) NOT NULL UNIQUE,
    
    -- Clasificación
    materia VARCHAR(100) NOT NULL,
    tipo_proceso VARCHAR(100) NOT NULL,
    unidad_judicial VARCHAR(200) NOT NULL,
    
    -- Funcionarios judiciales (referencias con ID + pseudónimo)
    juez_asignado_id INTEGER NOT NULL,
    juez_pseudonimo VARCHAR(50) NOT NULL,
    secretario_creador_id INTEGER NOT NULL,
    secretario_pseudonimo VARCHAR(50),
    
    -- Estado del proceso
    estado_procesal VARCHAR(30) NOT NULL DEFAULT 'INICIADA',
    
    -- Partes procesales (información pública - nombres reales)
    actor_nombre VARCHAR(255),
    actor_identificacion VARCHAR(20),
    demandado_nombre VARCHAR(255),
    demandado_identificacion VARCHAR(20),
    
    -- Descripción del caso
    descripcion TEXT,
    
    -- Datos adicionales
    cuantia DECIMAL(15,2),
    
    -- Auditoría
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    
    -- Restricciones
    CONSTRAINT chk_estado_procesal CHECK (estado_procesal IN ('INICIADA', 'EN_TRAMITE', 'RESUELTA', 'ARCHIVADA', 'SUSPENDIDA'))
);

-- Índices optimizados
CREATE INDEX IF NOT EXISTS idx_causas_numero_proceso ON causas(numero_proceso);
CREATE INDEX IF NOT EXISTS idx_causas_estado_procesal ON causas(estado_procesal);
CREATE INDEX IF NOT EXISTS idx_causas_materia ON causas(materia);
CREATE INDEX IF NOT EXISTS idx_causas_unidad_judicial ON causas(unidad_judicial);
CREATE INDEX IF NOT EXISTS idx_causas_fecha_creacion ON causas(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_causas_juez_asignado ON causas(juez_asignado_id);
CREATE INDEX IF NOT EXISTS idx_causas_secretario_creador ON causas(secretario_creador_id);
CREATE INDEX IF NOT EXISTS idx_causas_actor_nombre ON causas(actor_nombre);
CREATE INDEX IF NOT EXISTS idx_causas_demandado_nombre ON causas(demandado_nombre);

COMMENT ON TABLE causas IS 'Registro de causas judiciales con pseudonimización de funcionarios';
COMMENT ON COLUMN causas.juez_pseudonimo IS 'Pseudónimo público del juez asignado (FDP_IFF)';
COMMENT ON COLUMN causas.actor_nombre IS 'Nombre del actor/demandante (información pública)';

-- ============================================================================
-- TABLA: mapa_pseudonimos
-- Propósito: Mapeo entre IDs reales de jueces y pseudónimos públicos
-- CRÍTICO: Acceso restringido para proteger identidad
-- ============================================================================
CREATE TABLE IF NOT EXISTS mapa_pseudonimos (
    mapa_id SERIAL PRIMARY KEY,
    juez_id_real INTEGER NOT NULL UNIQUE,
    pseudonimo_publico VARCHAR(50) NOT NULL UNIQUE,
    fecha_generacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mapa_pseudonimos_juez ON mapa_pseudonimos(juez_id_real);
CREATE INDEX IF NOT EXISTS idx_mapa_pseudonimos_pseudonimo ON mapa_pseudonimos(pseudonimo_publico);

COMMENT ON TABLE mapa_pseudonimos IS 'Mapeo seguro entre IDs reales de jueces y pseudónimos públicos (FDP_IFF)';

-- ============================================================================
-- TABLA: expedientes
-- Propósito: Expedientes electrónicos asociados a causas
-- ============================================================================
CREATE TABLE IF NOT EXISTS expedientes (
    expediente_id SERIAL PRIMARY KEY,
    causa_id INTEGER NOT NULL REFERENCES causas(causa_id) ON DELETE CASCADE,
    fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    observaciones TEXT
);

CREATE INDEX IF NOT EXISTS idx_expedientes_causa ON expedientes(causa_id);

COMMENT ON TABLE expedientes IS 'Expedientes electrónicos de causas judiciales';

-- ============================================================================
-- TABLA: documentos
-- Propósito: Metadatos de documentos del expediente
-- ============================================================================
CREATE TABLE IF NOT EXISTS documentos (
    id VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    causa_id INTEGER NOT NULL REFERENCES causas(causa_id) ON DELETE CASCADE,
    
    -- Identificación
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    
    -- Archivo
    ruta VARCHAR(500),
    formato VARCHAR(10),
    tamano_bytes BIGINT,
    hash_integridad VARCHAR(64) NOT NULL,
    
    -- Estado
    estado VARCHAR(30) NOT NULL DEFAULT 'activo',
    
    -- Auditoría
    fecha_subida TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subido_por_id INTEGER,
    
    CONSTRAINT chk_estado_documento CHECK (estado IN ('activo', 'eliminado', 'borrador', 'pendiente', 'firmado', 'notificado'))
);

CREATE INDEX IF NOT EXISTS idx_documentos_causa ON documentos(causa_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON documentos(tipo);
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON documentos(estado);
CREATE INDEX IF NOT EXISTS idx_documentos_fecha_subida ON documentos(fecha_subida);

COMMENT ON TABLE documentos IS 'Metadatos de documentos asociados a causas';
COMMENT ON COLUMN documentos.hash_integridad IS 'Hash SHA256 para verificar integridad del documento';

-- ============================================================================
-- TABLA: audiencias
-- Propósito: Programación y registro de audiencias
-- ============================================================================
CREATE TABLE IF NOT EXISTS audiencias (
    audiencia_id SERIAL PRIMARY KEY,
    causa_id INTEGER NOT NULL REFERENCES causas(causa_id) ON DELETE CASCADE,
    
    -- Programación (campos legados + nuevos)
    tipo VARCHAR(50) NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    fecha_hora_programada TIMESTAMPTZ,  -- Campo unificado fecha+hora
    fecha_programada TIMESTAMPTZ,  -- Alias usado por el backend
    sala VARCHAR(50),
    
    -- Configuración Sprint 2
    modalidad VARCHAR(20) DEFAULT 'PRESENCIAL',
    enlace_videoconferencia VARCHAR(500),
    
    -- Estado
    estado VARCHAR(30) NOT NULL DEFAULT 'programada',
    
    -- Resultado de audiencia
    acta_audiencia TEXT,
    resultado VARCHAR(100),
    duracion_minutos INTEGER,
    
    -- Notas
    notas TEXT,
    
    -- Auditoría Sprint 2
    creado_por_secretario_id INTEGER,
    notificado_partes BOOLEAN DEFAULT FALSE,
    fecha_notificacion TIMESTAMPTZ,
    
    -- Timestamps
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_estado_audiencia CHECK (estado IN (
        'programada', 'realizada', 'reprogramada', 'cancelada',
        'PROGRAMADA', 'REALIZADA', 'REPROGRAMADA', 'CANCELADA', 'EN_CURSO'
    )),
    CONSTRAINT chk_modalidad_audiencia CHECK (modalidad IN ('PRESENCIAL', 'VIRTUAL', 'HIBRIDA'))
);

CREATE INDEX IF NOT EXISTS idx_audiencias_causa ON audiencias(causa_id);
CREATE INDEX IF NOT EXISTS idx_audiencias_fecha ON audiencias(fecha);
CREATE INDEX IF NOT EXISTS idx_audiencias_estado ON audiencias(estado);

COMMENT ON TABLE audiencias IS 'Programación y registro de audiencias judiciales';

-- ============================================================================
-- TABLA: audiencias_historial_reprogramaciones
-- Propósito: Historial inmutable de reprogramaciones (Trazabilidad)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audiencias_historial_reprogramaciones (
    historial_id SERIAL PRIMARY KEY,
    audiencia_id INTEGER NOT NULL REFERENCES audiencias(audiencia_id) ON DELETE CASCADE,
    
    -- Estado anterior y nuevo
    fecha_hora_anterior TIMESTAMPTZ NOT NULL,
    sala_anterior VARCHAR(50),
    fecha_hora_nueva TIMESTAMPTZ NOT NULL,
    sala_nueva VARCHAR(50),
    
    -- Razón del cambio
    motivo_reprogramacion TEXT NOT NULL,
    tipo_cambio VARCHAR(30) NOT NULL,
    
    -- Auditoría
    modificado_por_secretario_id INTEGER NOT NULL,
    modificado_por_rol VARCHAR(50) NOT NULL,
    fecha_modificacion TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ip_modificacion VARCHAR(45),
    
    -- Estado resultante
    estado_anterior VARCHAR(30),
    estado_nuevo VARCHAR(30),
    
    CONSTRAINT chk_tipo_cambio CHECK (tipo_cambio IN ('REPROGRAMACION', 'CANCELACION', 'CAMBIO_SALA'))
);

CREATE INDEX IF NOT EXISTS idx_historial_audiencia ON audiencias_historial_reprogramaciones(audiencia_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha_mod ON audiencias_historial_reprogramaciones(fecha_modificacion);
CREATE INDEX IF NOT EXISTS idx_historial_modificador ON audiencias_historial_reprogramaciones(modificado_por_secretario_id);

COMMENT ON TABLE audiencias_historial_reprogramaciones IS 'Historial inmutable de reprogramaciones de audiencias (FAU_GEN.1)';

-- ============================================================================
-- TABLA: audiencias_asistentes
-- Propósito: Registro de participantes en audiencias
-- ============================================================================
CREATE TABLE IF NOT EXISTS audiencias_asistentes (
    asistente_id SERIAL PRIMARY KEY,
    audiencia_id INTEGER NOT NULL REFERENCES audiencias(audiencia_id) ON DELETE CASCADE,
    
    -- Identificación del asistente
    tipo_asistente VARCHAR(30) NOT NULL,
    persona_id INTEGER,
    nombre_completo VARCHAR(255) NOT NULL,
    rol_especifico VARCHAR(100),
    
    -- Control de asistencia
    confirmacion_asistencia BOOLEAN DEFAULT FALSE,
    fecha_confirmacion TIMESTAMPTZ,
    asistio BOOLEAN,
    hora_entrada TIMESTAMPTZ,
    hora_salida TIMESTAMPTZ,
    
    -- Observaciones
    observaciones TEXT,
    
    -- Auditoría
    fecha_registro TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    registrado_por_secretario_id INTEGER,
    
    CONSTRAINT chk_tipo_asistente CHECK (tipo_asistente IN 
        ('JUEZ', 'SECRETARIO', 'FISCAL', 'ACTOR', 'DEMANDADO', 'ABOGADO_ACTOR', 'ABOGADO_DEMANDADO', 'TESTIGO', 'PERITO'))
);

CREATE INDEX IF NOT EXISTS idx_asistentes_audiencia ON audiencias_asistentes(audiencia_id);
CREATE INDEX IF NOT EXISTS idx_asistentes_tipo ON audiencias_asistentes(tipo_asistente);
CREATE INDEX IF NOT EXISTS idx_asistentes_persona ON audiencias_asistentes(persona_id);

COMMENT ON TABLE audiencias_asistentes IS 'Registro de participantes en audiencias';

-- ============================================================================
-- TABLA: audiencias_notificaciones
-- Propósito: Track de notificaciones enviadas para audiencias
-- ============================================================================
CREATE TABLE IF NOT EXISTS audiencias_notificaciones (
    notificacion_id SERIAL PRIMARY KEY,
    audiencia_id INTEGER NOT NULL REFERENCES audiencias(audiencia_id) ON DELETE CASCADE,
    
    -- Destinatario
    destinatario_tipo VARCHAR(30) NOT NULL,
    destinatario_nombre VARCHAR(255) NOT NULL,
    destinatario_email VARCHAR(255),
    destinatario_telefono VARCHAR(20),
    
    -- Estado
    estado_notificacion VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    
    -- Metadatos de envío
    metodo_envio VARCHAR(20),
    fecha_envio TIMESTAMPTZ,
    fecha_entrega TIMESTAMPTZ,
    fecha_lectura TIMESTAMPTZ,
    
    -- Contenido
    contenido_notificacion TEXT,
    
    -- Auditoría
    fecha_creacion TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    intentos_envio INTEGER DEFAULT 0,
    ultimo_error TEXT,
    
    CONSTRAINT chk_destinatario_tipo_aud CHECK (destinatario_tipo IN 
        ('ACTOR', 'DEMANDADO', 'ABOGADO', 'TESTIGO', 'PERITO')),
    CONSTRAINT chk_estado_notificacion_aud CHECK (estado_notificacion IN 
        ('PENDIENTE', 'ENVIADA', 'ENTREGADA', 'FALLIDA', 'LEIDA')),
    CONSTRAINT chk_metodo_envio_aud CHECK (metodo_envio IN ('EMAIL', 'SMS', 'FISICO', 'SISTEMA'))
);

CREATE INDEX IF NOT EXISTS idx_notif_aud_audiencia ON audiencias_notificaciones(audiencia_id);
CREATE INDEX IF NOT EXISTS idx_notif_aud_estado ON audiencias_notificaciones(estado_notificacion);
CREATE INDEX IF NOT EXISTS idx_notif_aud_destinatario ON audiencias_notificaciones(destinatario_email);

COMMENT ON TABLE audiencias_notificaciones IS 'Trazabilidad de notificaciones de audiencias';

-- ============================================================================
-- TABLA: notificaciones
-- Propósito: Notificaciones generales del sistema (envío externo a partes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    causa_id INTEGER REFERENCES causas(causa_id) ON DELETE CASCADE,
    
    -- Tipo y contenido
    tipo VARCHAR(50) NOT NULL,
    destinatario VARCHAR(255) NOT NULL,
    asunto VARCHAR(500) NOT NULL,
    mensaje TEXT NOT NULL,
    
    -- Prioridad y estado
    prioridad VARCHAR(20) DEFAULT 'normal',
    estado VARCHAR(30) DEFAULT 'pendiente',
    
    -- Trazabilidad
    creada_por_id INTEGER,
    fecha_envio TIMESTAMPTZ,
    fecha_lectura TIMESTAMPTZ,
    
    -- Timestamps
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_causa ON notificaciones(causa_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_estado ON notificaciones(estado);
CREATE INDEX IF NOT EXISTS idx_notificaciones_destinatario ON notificaciones(destinatario);

COMMENT ON TABLE notificaciones IS 'Notificaciones a partes procesales y externos';

-- ============================================================================
-- TABLA: notificaciones_internas
-- Propósito: Notificaciones del sistema para funcionarios judiciales
-- ============================================================================
CREATE TABLE IF NOT EXISTS notificaciones_internas (
    notificacion_id SERIAL PRIMARY KEY,
    
    -- Destinatario
    destinatario_id INTEGER NOT NULL,
    
    -- Tipo y contenido
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT NOT NULL,
    
    -- Referencias
    causa_id INTEGER REFERENCES causas(causa_id) ON DELETE SET NULL,
    audiencia_id INTEGER REFERENCES audiencias(audiencia_id) ON DELETE SET NULL,
    
    -- Estado
    estado VARCHAR(30) NOT NULL DEFAULT 'no_leida',
    prioridad VARCHAR(20) NOT NULL DEFAULT 'normal',
    
    -- Metadata
    datos_adicionales JSONB,
    
    -- Auditoría
    creado_por_id INTEGER,
    ip_origen VARCHAR(45),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_lectura TIMESTAMPTZ,
    
    CONSTRAINT chk_tipo_notif_interna CHECK (tipo IN (
        'causa_asignada', 'audiencia_programada', 'audiencia_reprogramada',
        'audiencia_cancelada', 'documento_agregado', 'plazo_proximo', 'sistema'
    )),
    CONSTRAINT chk_estado_notif_interna CHECK (estado IN ('no_leida', 'leida', 'archivada')),
    CONSTRAINT chk_prioridad_notif_interna CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente'))
);

CREATE INDEX IF NOT EXISTS idx_notif_int_destinatario ON notificaciones_internas(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_notif_int_estado ON notificaciones_internas(estado);
CREATE INDEX IF NOT EXISTS idx_notif_int_tipo ON notificaciones_internas(tipo);
CREATE INDEX IF NOT EXISTS idx_notif_int_causa ON notificaciones_internas(causa_id);
CREATE INDEX IF NOT EXISTS idx_notif_int_fecha ON notificaciones_internas(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_notif_int_dest_estado ON notificaciones_internas(destinatario_id, estado);

COMMENT ON TABLE notificaciones_internas IS 'Notificaciones internas del sistema para funcionarios judiciales';

-- ============================================================================
-- TABLA: decisiones_judiciales (HU-JZ-003)
-- Propósito: Autos, providencias y sentencias con firma electrónica
-- Implementa inmutabilidad post-firma (WORM)
-- ============================================================================
CREATE TABLE IF NOT EXISTS decisiones_judiciales (
    decision_id SERIAL PRIMARY KEY,
    
    causa_id INTEGER NOT NULL REFERENCES causas(causa_id) ON DELETE RESTRICT,
    
    -- Autor
    juez_autor_id INTEGER NOT NULL,
    juez_pseudonimo VARCHAR(50) NOT NULL,
    
    -- Tipo
    tipo_decision VARCHAR(50) NOT NULL,
    
    -- Contenido
    titulo VARCHAR(500) NOT NULL,
    contenido_borrador TEXT,
    
    -- Estado (WORM)
    estado VARCHAR(30) NOT NULL DEFAULT 'BORRADOR',
    
    -- Firma electrónica
    fecha_firma TIMESTAMPTZ,
    ruta_pdf_firmado VARCHAR(500),
    hash_integridad_pdf CHAR(64),
    certificado_firmante VARCHAR(500),
    numero_serie_certificado VARCHAR(100),
    algoritmo_firma VARCHAR(50),
    firma_base64 TEXT,
    
    -- Versionado
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Documento relacionado
    documento_id VARCHAR(50) REFERENCES documentos(id) ON DELETE SET NULL,
    
    -- Auditoría
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    ip_creacion VARCHAR(45),
    
    CONSTRAINT chk_tipo_decision CHECK (tipo_decision IN ('AUTO', 'PROVIDENCIA', 'SENTENCIA')),
    CONSTRAINT chk_estado_decision CHECK (estado IN ('BORRADOR', 'LISTA_PARA_FIRMA', 'FIRMADA', 'ANULADA')),
    CONSTRAINT chk_firma_completa CHECK (
        (estado != 'FIRMADA') OR 
        (estado = 'FIRMADA' AND fecha_firma IS NOT NULL AND hash_integridad_pdf IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_decisiones_causa ON decisiones_judiciales(causa_id);
CREATE INDEX IF NOT EXISTS idx_decisiones_juez ON decisiones_judiciales(juez_autor_id);
CREATE INDEX IF NOT EXISTS idx_decisiones_tipo ON decisiones_judiciales(tipo_decision);
CREATE INDEX IF NOT EXISTS idx_decisiones_estado ON decisiones_judiciales(estado);
CREATE INDEX IF NOT EXISTS idx_decisiones_fecha_firma ON decisiones_judiciales(fecha_firma);
CREATE INDEX IF NOT EXISTS idx_decisiones_fecha_creacion ON decisiones_judiciales(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_decisiones_juez_estado ON decisiones_judiciales(juez_autor_id, estado);

COMMENT ON TABLE decisiones_judiciales IS 'Autos, providencias y sentencias con firma electrónica (HU-JZ-003)';
COMMENT ON COLUMN decisiones_judiciales.estado IS 'BORRADOR: editable, LISTA_PARA_FIRMA: revisada, FIRMADA: inmutable';

-- ============================================================================
-- TABLA: historial_decisiones
-- Propósito: Auditoría de cambios en borradores de decisiones
-- ============================================================================
CREATE TABLE IF NOT EXISTS historial_decisiones (
    historial_id SERIAL PRIMARY KEY,
    decision_id INTEGER NOT NULL REFERENCES decisiones_judiciales(decision_id) ON DELETE CASCADE,
    
    version_anterior INTEGER NOT NULL,
    contenido_anterior TEXT,
    estado_anterior VARCHAR(30),
    
    modificado_por_id INTEGER NOT NULL,
    fecha_modificacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_origen VARCHAR(45),
    motivo_cambio TEXT
);

CREATE INDEX IF NOT EXISTS idx_historial_decision ON historial_decisiones(decision_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_decisiones(fecha_modificacion);

COMMENT ON TABLE historial_decisiones IS 'Historial de versiones de decisiones antes de firma';

-- ============================================================================
-- TABLA: notificaciones_procesales (HU-SJ-004)
-- Propósito: Notificaciones legales a las partes del proceso
-- ============================================================================
CREATE TABLE IF NOT EXISTS notificaciones_procesales (
    notificacion_id SERIAL PRIMARY KEY,
    
    -- Referencias
    causa_id INTEGER NOT NULL REFERENCES causas(causa_id) ON DELETE RESTRICT,
    decision_id INTEGER REFERENCES decisiones_judiciales(decision_id) ON DELETE SET NULL,
    documento_id VARCHAR(50) REFERENCES documentos(id) ON DELETE SET NULL,
    
    -- Destinatario
    destinatario_tipo VARCHAR(50) NOT NULL,
    destinatario_nombre VARCHAR(255) NOT NULL,
    destinatario_identificacion VARCHAR(20),
    destinatario_correo VARCHAR(255),
    destinatario_direccion TEXT,
    destinatario_casillero VARCHAR(50),
    
    -- Contenido
    tipo_notificacion VARCHAR(50) NOT NULL,
    asunto VARCHAR(500) NOT NULL,
    contenido TEXT,
    
    -- Medio
    medio VARCHAR(50) NOT NULL DEFAULT 'BUZON_ELECTRONICO',
    
    -- Estado y tracking
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    intentos_envio INTEGER DEFAULT 0,
    
    -- Timestamps
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_envio TIMESTAMPTZ,
    fecha_recepcion TIMESTAMPTZ,
    fecha_lectura TIMESTAMPTZ,
    
    -- Auditoría
    creado_por_id INTEGER NOT NULL,
    creado_por_pseudonimo VARCHAR(50),
    ip_origen VARCHAR(45),
    
    -- Integridad
    hash_contenido CHAR(64),
    comprobante_envio TEXT,
    
    CONSTRAINT chk_destinatario_tipo CHECK (destinatario_tipo IN (
        'actor', 'demandado', 'abogado_actor', 'abogado_demandado', 
        'tercero', 'perito', 'testigo', 'ministerio_publico', 'otro'
    )),
    CONSTRAINT chk_tipo_notificacion CHECK (tipo_notificacion IN (
        'citacion', 'notificacion', 'emplazamiento', 'auto', 
        'providencia', 'sentencia', 'recordatorio', 'otro'
    )),
    CONSTRAINT chk_medio_notificacion CHECK (medio IN (
        'BUZON_ELECTRONICO', 'CORREO_ELECTRONICO', 'FISICO', 
        'CASILLERO_JUDICIAL', 'PUBLICACION', 'DEPRECATORIO'
    )),
    CONSTRAINT chk_estado_notificacion CHECK (estado IN (
        'PENDIENTE', 'ENVIADA', 'RECIBIDA', 'LEIDA', 'FALLIDA', 'CANCELADA'
    ))
);

CREATE INDEX IF NOT EXISTS idx_notif_proc_causa ON notificaciones_procesales(causa_id);
CREATE INDEX IF NOT EXISTS idx_notif_proc_decision ON notificaciones_procesales(decision_id);
CREATE INDEX IF NOT EXISTS idx_notif_proc_estado ON notificaciones_procesales(estado);
CREATE INDEX IF NOT EXISTS idx_notif_proc_fecha_creacion ON notificaciones_procesales(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_notif_proc_destinatario ON notificaciones_procesales(destinatario_identificacion);
CREATE INDEX IF NOT EXISTS idx_notif_proc_tipo ON notificaciones_procesales(tipo_notificacion);
CREATE INDEX IF NOT EXISTS idx_notif_proc_pendientes ON notificaciones_procesales(estado, fecha_creacion) 
    WHERE estado IN ('PENDIENTE', 'ENVIADA');

COMMENT ON TABLE notificaciones_procesales IS 'Notificaciones legales a partes del proceso (HU-SJ-004)';

-- ============================================================================
-- TABLA: plazos_procesales (HU-SJ-004)
-- Propósito: Control de plazos judiciales con alertas automáticas
-- ============================================================================
CREATE TABLE IF NOT EXISTS plazos_procesales (
    plazo_id SERIAL PRIMARY KEY,
    
    -- Referencias
    causa_id INTEGER NOT NULL REFERENCES causas(causa_id) ON DELETE RESTRICT,
    notificacion_id INTEGER REFERENCES notificaciones_procesales(notificacion_id) ON DELETE SET NULL,
    decision_id INTEGER REFERENCES decisiones_judiciales(decision_id) ON DELETE SET NULL,
    
    -- Descripción
    tipo_plazo VARCHAR(100) NOT NULL,
    descripcion VARCHAR(500) NOT NULL,
    
    -- Parte afectada
    parte_responsable VARCHAR(50),
    
    -- Fechas
    fecha_inicio TIMESTAMPTZ NOT NULL,
    dias_plazo INTEGER NOT NULL,
    fecha_vencimiento TIMESTAMPTZ NOT NULL,
    
    -- Estado
    estado VARCHAR(30) NOT NULL DEFAULT 'VIGENTE',
    
    -- Alertas
    alerta_enviada_3_dias BOOLEAN DEFAULT FALSE,
    alerta_enviada_1_dia BOOLEAN DEFAULT FALSE,
    alerta_enviada_vencido BOOLEAN DEFAULT FALSE,
    
    -- Suspensión
    suspendido BOOLEAN DEFAULT FALSE,
    fecha_suspension TIMESTAMPTZ,
    fecha_reanudacion TIMESTAMPTZ,
    motivo_suspension TEXT,
    
    -- Cumplimiento
    cumplido BOOLEAN DEFAULT FALSE,
    fecha_cumplimiento TIMESTAMPTZ,
    observaciones_cumplimiento TEXT,
    
    -- Auditoría
    creado_por_id INTEGER NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_tipo_plazo CHECK (tipo_plazo IN (
        'contestacion_demanda', 'interposicion_recurso', 'cumplimiento_auto',
        'presentacion_pruebas', 'alegatos', 'apelacion', 'casacion',
        'ejecucion_sentencia', 'subsanacion', 'comparecencia', 'otro'
    )),
    CONSTRAINT chk_estado_plazo CHECK (estado IN (
        'VIGENTE', 'VENCIDO', 'CUMPLIDO', 'SUSPENDIDO', 'CANCELADO'
    )),
    CONSTRAINT chk_parte_responsable CHECK (parte_responsable IN (
        'actor', 'demandado', 'ambas_partes', 'juez', 'secretario', 'perito', 'otro'
    ))
);

CREATE INDEX IF NOT EXISTS idx_plazos_causa ON plazos_procesales(causa_id);
CREATE INDEX IF NOT EXISTS idx_plazos_notificacion ON plazos_procesales(notificacion_id);
CREATE INDEX IF NOT EXISTS idx_plazos_estado ON plazos_procesales(estado);
CREATE INDEX IF NOT EXISTS idx_plazos_vencimiento ON plazos_procesales(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_plazos_alertas ON plazos_procesales(fecha_vencimiento, estado) 
    WHERE estado = 'VIGENTE';

COMMENT ON TABLE plazos_procesales IS 'Control de plazos judiciales con alertas (HU-SJ-004)';

-- ============================================================================
-- TABLA: catalogo_tipos_actuacion (HU-SJ-004)
-- Propósito: Catálogo de tipos de actuación con plazos legales predefinidos
-- ============================================================================
CREATE TABLE IF NOT EXISTS catalogo_tipos_actuacion (
    tipo_id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    plazo_dias_habiles INTEGER NOT NULL,
    parte_responsable_default VARCHAR(50),
    materia VARCHAR(100),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE catalogo_tipos_actuacion IS 'Catálogo de tipos de actuación con plazos legales';

-- Insertar catálogo inicial
INSERT INTO catalogo_tipos_actuacion (codigo, nombre, descripcion, plazo_dias_habiles, parte_responsable_default, materia) VALUES
    ('CONTESTACION_DEMANDA', 'Contestación a la demanda', 'Plazo para contestar la demanda inicial', 15, 'demandado', NULL),
    ('RECURSO_APELACION', 'Recurso de apelación', 'Plazo para interponer recurso de apelación', 3, NULL, NULL),
    ('RECURSO_CASACION', 'Recurso de casación', 'Plazo para interponer recurso de casación', 5, NULL, NULL),
    ('PRESENTACION_PRUEBAS', 'Presentación de pruebas', 'Plazo para anunciar y presentar pruebas', 10, 'ambas_partes', NULL),
    ('ALEGATOS', 'Presentación de alegatos', 'Plazo para presentar alegatos finales', 5, 'ambas_partes', NULL),
    ('SUBSANACION', 'Subsanación de requisitos', 'Plazo para subsanar omisiones', 3, NULL, NULL),
    ('CUMPLIMIENTO_AUTO', 'Cumplimiento de auto', 'Plazo para cumplir lo ordenado en auto', 5, NULL, NULL),
    ('COMPARECENCIA', 'Comparecencia a audiencia', 'Plazo mínimo para citación a audiencia', 3, 'ambas_partes', NULL),
    ('EJECUCION_VOLUNTARIA', 'Ejecución voluntaria', 'Plazo para cumplimiento voluntario de sentencia', 5, 'demandado', NULL),
    ('RECONVENCION', 'Reconvención', 'Plazo para presentar reconvención', 15, 'demandado', 'CIVIL'),
    ('EXCEPCIONES', 'Excepciones previas', 'Plazo para presentar excepciones', 10, 'demandado', NULL)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================================
-- TABLA: dias_inhabiles
-- Propósito: Registro de días feriados y no laborables para cálculo de plazos
-- ============================================================================
CREATE TABLE IF NOT EXISTS dias_inhabiles (
    dia_id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL UNIQUE,
    descripcion VARCHAR(200),
    tipo VARCHAR(50) DEFAULT 'feriado',
    anio INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM fecha)) STORED,
    
    CONSTRAINT chk_tipo_dia CHECK (tipo IN ('feriado', 'suspension_judicial', 'vacacion_judicial', 'otro'))
);

CREATE INDEX IF NOT EXISTS idx_dias_inhabiles_fecha ON dias_inhabiles(fecha);
CREATE INDEX IF NOT EXISTS idx_dias_inhabiles_anio ON dias_inhabiles(anio);

COMMENT ON TABLE dias_inhabiles IS 'Días feriados y no laborables para cálculo de plazos';

-- Insertar feriados de Ecuador 2026
INSERT INTO dias_inhabiles (fecha, descripcion, tipo) VALUES
    ('2026-01-01', 'Año Nuevo', 'feriado'),
    ('2026-02-16', 'Carnaval', 'feriado'),
    ('2026-02-17', 'Carnaval', 'feriado'),
    ('2026-04-03', 'Viernes Santo', 'feriado'),
    ('2026-05-01', 'Día del Trabajo', 'feriado'),
    ('2026-05-24', 'Batalla de Pichincha', 'feriado'),
    ('2026-08-10', 'Primer Grito de Independencia', 'feriado'),
    ('2026-10-09', 'Independencia de Guayaquil', 'feriado'),
    ('2026-11-02', 'Día de los Difuntos', 'feriado'),
    ('2026-11-03', 'Independencia de Cuenca', 'feriado'),
    ('2026-12-25', 'Navidad', 'feriado')
ON CONFLICT (fecha) DO NOTHING;

-- ============================================================================
-- FUNCIÓN: Actualizar timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualización automática
DROP TRIGGER IF EXISTS trigger_actualizar_fecha_causas ON causas;
CREATE TRIGGER trigger_actualizar_fecha_causas
    BEFORE UPDATE ON causas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_fecha_audiencias ON audiencias;
CREATE TRIGGER trigger_actualizar_fecha_audiencias
    BEFORE UPDATE ON audiencias
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_fecha_plazos ON plazos_procesales;
CREATE TRIGGER trigger_actualizar_fecha_plazos
    BEFORE UPDATE ON plazos_procesales
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

-- ============================================================================
-- TRIGGER: Inmutabilidad de Decisiones Firmadas (WORM)
-- ============================================================================
CREATE OR REPLACE FUNCTION bloquear_modificacion_firmados() 
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.estado = 'FIRMADA' THEN
        IF TG_OP = 'UPDATE' AND NEW.estado = 'ANULADA' THEN
            RAISE NOTICE 'Anulación de decisión firmada ID: %. Requiere proceso formal.', OLD.decision_id;
            RETURN NEW;
        END IF;
        
        RAISE EXCEPTION 'SEGURIDAD: No se puede modificar una decisión firmada (ID: %). Las decisiones firmadas son inmutables.', OLD.decision_id
            USING ERRCODE = 'restrict_violation';
    END IF;
    
    IF TG_OP = 'UPDATE' AND OLD.estado = 'BORRADOR' AND NEW.estado = 'BORRADOR' THEN
        NEW.version := OLD.version + 1;
    END IF;
    
    NEW.fecha_actualizacion := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inmutabilidad_decisiones_update ON decisiones_judiciales;
CREATE TRIGGER trg_inmutabilidad_decisiones_update
    BEFORE UPDATE ON decisiones_judiciales
    FOR EACH ROW 
    EXECUTE FUNCTION bloquear_modificacion_firmados();

CREATE OR REPLACE FUNCTION bloquear_eliminacion_firmados() 
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.estado = 'FIRMADA' THEN
        RAISE EXCEPTION 'SEGURIDAD: No se puede eliminar una decisión firmada (ID: %). Las decisiones firmadas son inmutables.', OLD.decision_id
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inmutabilidad_decisiones_delete ON decisiones_judiciales;
CREATE TRIGGER trg_inmutabilidad_decisiones_delete
    BEFORE DELETE ON decisiones_judiciales
    FOR EACH ROW 
    EXECUTE FUNCTION bloquear_eliminacion_firmados();

-- ============================================================================
-- FUNCIÓN: Calcular fecha de vencimiento considerando días hábiles
-- ============================================================================
CREATE OR REPLACE FUNCTION calcular_fecha_vencimiento(
    p_fecha_inicio TIMESTAMPTZ,
    p_dias_habiles INTEGER
) RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_fecha_actual DATE;
    v_dias_contados INTEGER := 0;
BEGIN
    v_fecha_actual := p_fecha_inicio::DATE;
    
    WHILE v_dias_contados < p_dias_habiles LOOP
        v_fecha_actual := v_fecha_actual + INTERVAL '1 day';
        
        IF EXTRACT(DOW FROM v_fecha_actual) NOT IN (0, 6)
           AND NOT EXISTS (
               SELECT 1 FROM dias_inhabiles WHERE fecha = v_fecha_actual
           ) THEN
            v_dias_contados := v_dias_contados + 1;
        END IF;
    END LOOP;
    
    RETURN v_fecha_actual + INTERVAL '23 hours 59 minutes 59 seconds';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_fecha_vencimiento IS 'Calcula fecha de vencimiento considerando días hábiles y feriados';

-- ============================================================================
-- VISTA: Plazos próximos a vencer
-- ============================================================================
CREATE OR REPLACE VIEW v_plazos_proximos_vencer AS
SELECT 
    p.plazo_id,
    p.causa_id,
    c.numero_proceso,
    c.juez_asignado_id,
    c.juez_pseudonimo,
    c.secretario_creador_id,
    p.tipo_plazo,
    p.descripcion,
    p.parte_responsable,
    p.fecha_inicio,
    p.fecha_vencimiento,
    p.estado,
    EXTRACT(DAY FROM (p.fecha_vencimiento - NOW())) AS dias_restantes,
    CASE 
        WHEN p.fecha_vencimiento < NOW() THEN 'VENCIDO'
        WHEN p.fecha_vencimiento <= NOW() + INTERVAL '1 day' THEN 'CRITICO'
        WHEN p.fecha_vencimiento <= NOW() + INTERVAL '3 days' THEN 'URGENTE'
        WHEN p.fecha_vencimiento <= NOW() + INTERVAL '7 days' THEN 'PROXIMO'
        ELSE 'NORMAL'
    END AS nivel_urgencia
FROM plazos_procesales p
JOIN causas c ON p.causa_id = c.causa_id
WHERE p.estado = 'VIGENTE'
ORDER BY p.fecha_vencimiento ASC;

COMMENT ON VIEW v_plazos_proximos_vencer IS 'Vista de plazos próximos a vencer con nivel de urgencia';

-- ============================================================================
-- VISTA: Resumen de decisiones por causa
-- ============================================================================
CREATE OR REPLACE VIEW v_decisiones_causa AS
SELECT 
    d.decision_id,
    d.causa_id,
    c.numero_proceso,
    d.tipo_decision,
    d.titulo,
    d.estado,
    d.juez_pseudonimo,
    d.fecha_creacion,
    d.fecha_firma,
    d.hash_integridad_pdf,
    d.version
FROM decisiones_judiciales d
JOIN causas c ON d.causa_id = c.causa_id
ORDER BY d.fecha_creacion DESC;

COMMENT ON VIEW v_decisiones_causa IS 'Resumen de decisiones judiciales por causa';

-- ============================================================================
-- Verificación de creación
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Schema de casos creado correctamente';
END $$;

SELECT 'Tablas creadas:' AS info;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'causas', 'mapa_pseudonimos', 'expedientes', 'documentos', 'audiencias',
    'notificaciones_internas', 'decisiones_judiciales', 'historial_decisiones',
    'notificaciones_procesales', 'plazos_procesales', 'catalogo_tipos_actuacion', 'dias_inhabiles'
);
