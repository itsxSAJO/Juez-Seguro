-- ============================================================================
-- JUEZ SEGURO - Sprint 3: Esquema de Base de Datos
-- Integridad, Firma Electrónica y Control de Plazos
-- ============================================================================
-- HU-JZ-003: Elaboración y firma de autos, providencias y sentencias
-- HU-SJ-004: Notificaciones procesales y control de plazos judiciales
-- ============================================================================
-- Ejecutar en: db_casos
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLA: decisiones_judiciales (HU-JZ-003)
-- Propósito: Almacenar autos, providencias y sentencias con firma electrónica
-- Implementa inmutabilidad post-firma (WORM - Write Once Read Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS decisiones_judiciales (
    decision_id SERIAL PRIMARY KEY,
    
    -- Referencia a la causa
    causa_id INTEGER NOT NULL REFERENCES causas(causa_id) ON DELETE RESTRICT,
    
    -- Autor de la decisión (validado contra token de sesión - FIA_USB.1)
    juez_autor_id INTEGER NOT NULL,  -- ID del juez en db_usuarios
    juez_pseudonimo VARCHAR(50) NOT NULL,  -- Pseudónimo público (FDP)
    
    -- Tipo de decisión judicial
    tipo_decision VARCHAR(50) NOT NULL,
    
    -- Contenido del documento
    titulo VARCHAR(500) NOT NULL,
    contenido_borrador TEXT,  -- HTML o texto enriquecido antes de firmar
    
    -- Máquina de Estados (CRÍTICO para seguridad)
    -- BORRADOR: Editable por el juez autor
    -- LISTA_PARA_FIRMA: Revisada, pendiente de firma
    -- FIRMADA: Inmutable, con hash de integridad
    estado VARCHAR(30) NOT NULL DEFAULT 'BORRADOR',
    
    -- Metadatos de Integridad (Solo presentes tras la firma)
    fecha_firma TIMESTAMPTZ,
    ruta_pdf_firmado VARCHAR(500),  -- Ruta en volumen WORM
    hash_integridad_pdf CHAR(64),   -- SHA-256 del archivo PDF firmado
    
    -- Metadatos de firma electrónica
    certificado_firmante VARCHAR(500),  -- CN del certificado usado
    numero_serie_certificado VARCHAR(100),  -- Serial del certificado
    algoritmo_firma VARCHAR(50),  -- ej: SHA256withRSA
    firma_base64 TEXT,  -- Firma digital en Base64
    
    -- Versionado (solo aplica en estado BORRADOR)
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Documento relacionado (si existe versión en tabla documentos)
    documento_id VARCHAR(50) REFERENCES documentos(id) ON DELETE SET NULL,
    
    -- Auditoría
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    ip_creacion VARCHAR(45),
    
    -- Restricciones de integridad
    CONSTRAINT chk_tipo_decision CHECK (tipo_decision IN ('AUTO', 'PROVIDENCIA', 'SENTENCIA')),
    CONSTRAINT chk_estado_decision CHECK (estado IN ('BORRADOR', 'LISTA_PARA_FIRMA', 'FIRMADA', 'ANULADA')),
    CONSTRAINT chk_firma_completa CHECK (
        (estado != 'FIRMADA') OR 
        (estado = 'FIRMADA' AND fecha_firma IS NOT NULL AND hash_integridad_pdf IS NOT NULL)
    )
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_decisiones_causa ON decisiones_judiciales(causa_id);
CREATE INDEX IF NOT EXISTS idx_decisiones_juez ON decisiones_judiciales(juez_autor_id);
CREATE INDEX IF NOT EXISTS idx_decisiones_tipo ON decisiones_judiciales(tipo_decision);
CREATE INDEX IF NOT EXISTS idx_decisiones_estado ON decisiones_judiciales(estado);
CREATE INDEX IF NOT EXISTS idx_decisiones_fecha_firma ON decisiones_judiciales(fecha_firma);
CREATE INDEX IF NOT EXISTS idx_decisiones_fecha_creacion ON decisiones_judiciales(fecha_creacion);

-- Índice compuesto para búsquedas del juez
CREATE INDEX IF NOT EXISTS idx_decisiones_juez_estado ON decisiones_judiciales(juez_autor_id, estado);

-- Comentarios de documentación
COMMENT ON TABLE decisiones_judiciales IS 'Autos, providencias y sentencias con firma electrónica (HU-JZ-003)';
COMMENT ON COLUMN decisiones_judiciales.estado IS 'BORRADOR: editable, LISTA_PARA_FIRMA: revisada, FIRMADA: inmutable';
COMMENT ON COLUMN decisiones_judiciales.hash_integridad_pdf IS 'SHA-256 del PDF firmado para verificar integridad';
COMMENT ON COLUMN decisiones_judiciales.firma_base64 IS 'Firma digital RSA en formato Base64';

-- ============================================================================
-- TRIGGER: Inmutabilidad de Decisiones Firmadas (Security Gate)
-- Bloquea cualquier UPDATE/DELETE si el estado ya es 'FIRMADA'
-- Implementa el principio WORM (Write Once Read Many)
-- ============================================================================
CREATE OR REPLACE FUNCTION bloquear_modificacion_firmados() 
RETURNS TRIGGER AS $$
BEGIN
    -- Bloquear modificaciones a documentos firmados
    IF OLD.estado = 'FIRMADA' THEN
        -- Permitir solo cambio a ANULADA (requiere proceso judicial especial)
        IF TG_OP = 'UPDATE' AND NEW.estado = 'ANULADA' THEN
            -- Registrar intento de anulación (requiere auditoría especial)
            -- La anulación debe hacerse mediante proceso judicial formal
            RAISE NOTICE 'Anulación de decisión firmada ID: %. Requiere proceso formal.', OLD.decision_id;
            RETURN NEW;
        END IF;
        
        RAISE EXCEPTION 'SEGURIDAD: Intento de violación de integridad. No se puede modificar una decisión firmada (ID: %). Las decisiones firmadas son inmutables.', OLD.decision_id
            USING ERRCODE = 'restrict_violation';
    END IF;
    
    -- Incrementar versión en borradores
    IF TG_OP = 'UPDATE' AND OLD.estado = 'BORRADOR' AND NEW.estado = 'BORRADOR' THEN
        NEW.version := OLD.version + 1;
    END IF;
    
    -- Actualizar timestamp
    NEW.fecha_actualizacion := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para UPDATE
DROP TRIGGER IF EXISTS trg_inmutabilidad_decisiones_update ON decisiones_judiciales;
CREATE TRIGGER trg_inmutabilidad_decisiones_update
    BEFORE UPDATE ON decisiones_judiciales
    FOR EACH ROW 
    EXECUTE FUNCTION bloquear_modificacion_firmados();

-- Trigger para DELETE (bloquear eliminación de firmados)
CREATE OR REPLACE FUNCTION bloquear_eliminacion_firmados() 
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.estado = 'FIRMADA' THEN
        RAISE EXCEPTION 'SEGURIDAD: No se puede eliminar una decisión firmada (ID: %). Las decisiones firmadas son inmutables y deben preservarse.', OLD.decision_id
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
-- TABLA: historial_decisiones (Auditoría de cambios en borradores)
-- Registra todos los cambios antes de la firma
-- ============================================================================
CREATE TABLE IF NOT EXISTS historial_decisiones (
    historial_id SERIAL PRIMARY KEY,
    decision_id INTEGER NOT NULL REFERENCES decisiones_judiciales(decision_id) ON DELETE CASCADE,
    
    -- Datos del cambio
    version_anterior INTEGER NOT NULL,
    contenido_anterior TEXT,
    estado_anterior VARCHAR(30),
    
    -- Auditoría
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
-- Propósito: Registrar notificaciones legales a las partes del proceso
-- Diferente de notificaciones_internas (que son del sistema)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notificaciones_procesales (
    notificacion_id SERIAL PRIMARY KEY,
    
    -- Referencias
    causa_id INTEGER NOT NULL REFERENCES causas(causa_id) ON DELETE RESTRICT,
    decision_id INTEGER REFERENCES decisiones_judiciales(decision_id) ON DELETE SET NULL,
    documento_id VARCHAR(50) REFERENCES documentos(id) ON DELETE SET NULL,
    
    -- Destinatario de la notificación
    destinatario_tipo VARCHAR(50) NOT NULL,  -- actor, demandado, abogado_actor, abogado_demandado, tercero
    destinatario_nombre VARCHAR(255) NOT NULL,
    destinatario_identificacion VARCHAR(20),
    destinatario_correo VARCHAR(255),
    destinatario_direccion TEXT,
    destinatario_casillero VARCHAR(50),  -- Casillero judicial
    
    -- Contenido de la notificación
    tipo_notificacion VARCHAR(50) NOT NULL,
    asunto VARCHAR(500) NOT NULL,
    contenido TEXT,
    
    -- Medio de notificación
    medio VARCHAR(50) NOT NULL DEFAULT 'BUZON_ELECTRONICO',
    
    -- Estado y tracking
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    intentos_envio INTEGER DEFAULT 0,
    
    -- Timestamps confiables (del servidor, no del cliente)
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_envio TIMESTAMPTZ,  -- Cuando se envió efectivamente
    fecha_recepcion TIMESTAMPTZ,  -- Confirmación de recepción
    fecha_lectura TIMESTAMPTZ,  -- Cuando el destinatario la leyó
    
    -- Auditoría
    creado_por_id INTEGER NOT NULL,  -- Secretario que creó la notificación
    creado_por_pseudonimo VARCHAR(50),
    ip_origen VARCHAR(45),
    
    -- Hash de integridad del contenido notificado
    hash_contenido CHAR(64),
    
    -- Comprobante de envío/recepción
    comprobante_envio TEXT,  -- ID de tracking, acuse de recibo, etc.
    
    -- Restricciones
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

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_notif_proc_causa ON notificaciones_procesales(causa_id);
CREATE INDEX IF NOT EXISTS idx_notif_proc_decision ON notificaciones_procesales(decision_id);
CREATE INDEX IF NOT EXISTS idx_notif_proc_estado ON notificaciones_procesales(estado);
CREATE INDEX IF NOT EXISTS idx_notif_proc_fecha_creacion ON notificaciones_procesales(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_notif_proc_destinatario ON notificaciones_procesales(destinatario_identificacion);
CREATE INDEX IF NOT EXISTS idx_notif_proc_tipo ON notificaciones_procesales(tipo_notificacion);

-- Índice para búsqueda de pendientes
CREATE INDEX IF NOT EXISTS idx_notif_proc_pendientes ON notificaciones_procesales(estado, fecha_creacion) 
    WHERE estado IN ('PENDIENTE', 'ENVIADA');

COMMENT ON TABLE notificaciones_procesales IS 'Notificaciones legales a partes del proceso (HU-SJ-004)';
COMMENT ON COLUMN notificaciones_procesales.fecha_envio IS 'Timestamp del servidor cuando se envió (sello de tiempo confiable)';

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
    
    -- Descripción del plazo
    tipo_plazo VARCHAR(100) NOT NULL,
    descripcion VARCHAR(500) NOT NULL,
    
    -- Parte afectada
    parte_responsable VARCHAR(50),  -- actor, demandado, ambas_partes
    
    -- Fechas del plazo
    fecha_inicio TIMESTAMPTZ NOT NULL,  -- Generalmente fecha de notificación
    dias_plazo INTEGER NOT NULL,  -- Días hábiles del plazo
    fecha_vencimiento TIMESTAMPTZ NOT NULL,  -- Calculada por el backend
    
    -- Estado del plazo
    estado VARCHAR(30) NOT NULL DEFAULT 'VIGENTE',
    
    -- Alertas
    alerta_enviada_3_dias BOOLEAN DEFAULT FALSE,
    alerta_enviada_1_dia BOOLEAN DEFAULT FALSE,
    alerta_enviada_vencido BOOLEAN DEFAULT FALSE,
    
    -- Suspensión del plazo (si aplica)
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
    
    -- Restricciones
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

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_plazos_causa ON plazos_procesales(causa_id);
CREATE INDEX IF NOT EXISTS idx_plazos_notificacion ON plazos_procesales(notificacion_id);
CREATE INDEX IF NOT EXISTS idx_plazos_estado ON plazos_procesales(estado);
CREATE INDEX IF NOT EXISTS idx_plazos_vencimiento ON plazos_procesales(fecha_vencimiento);

-- Índice para alertas de plazos próximos a vencer
CREATE INDEX IF NOT EXISTS idx_plazos_alertas ON plazos_procesales(fecha_vencimiento, estado) 
    WHERE estado = 'VIGENTE';

COMMENT ON TABLE plazos_procesales IS 'Control de plazos judiciales con alertas (HU-SJ-004)';
COMMENT ON COLUMN plazos_procesales.dias_plazo IS 'Días hábiles del plazo legal';
COMMENT ON COLUMN plazos_procesales.fecha_vencimiento IS 'Calculada automáticamente considerando días hábiles';

-- ============================================================================
-- TABLA: catalogo_tipos_actuacion (HU-SJ-004)
-- Propósito: Catálogo de tipos de actuación con plazos legales predefinidos
-- ============================================================================
CREATE TABLE IF NOT EXISTS catalogo_tipos_actuacion (
    tipo_id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    
    -- Plazos legales por defecto
    plazo_dias_habiles INTEGER NOT NULL,
    
    -- Tipo de parte que debe cumplir
    parte_responsable_default VARCHAR(50),
    
    -- Materia aplicable (NULL = todas)
    materia VARCHAR(100),
    
    -- Configuración
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar catálogo inicial de actuaciones con plazos
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

COMMENT ON TABLE catalogo_tipos_actuacion IS 'Catálogo de tipos de actuación con plazos legales';

-- ============================================================================
-- TABLA: dias_inhabiles (Para cálculo de plazos)
-- Propósito: Registro de días feriados y no laborables
-- ============================================================================
CREATE TABLE IF NOT EXISTS dias_inhabiles (
    dia_id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL UNIQUE,
    descripcion VARCHAR(200),
    tipo VARCHAR(50) DEFAULT 'feriado',  -- feriado, suspension_judicial, otro
    anio INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM fecha)) STORED,
    
    CONSTRAINT chk_tipo_dia CHECK (tipo IN ('feriado', 'suspension_judicial', 'vacacion_judicial', 'otro'))
);

CREATE INDEX IF NOT EXISTS idx_dias_inhabiles_fecha ON dias_inhabiles(fecha);
CREATE INDEX IF NOT EXISTS idx_dias_inhabiles_anio ON dias_inhabiles(anio);

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

COMMENT ON TABLE dias_inhabiles IS 'Días feriados y no laborables para cálculo de plazos';

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
        
        -- Verificar si es día hábil (no fin de semana, no feriado)
        IF EXTRACT(DOW FROM v_fecha_actual) NOT IN (0, 6)  -- No domingo (0) ni sábado (6)
           AND NOT EXISTS (
               SELECT 1 FROM dias_inhabiles WHERE fecha = v_fecha_actual
           ) THEN
            v_dias_contados := v_dias_contados + 1;
        END IF;
    END LOOP;
    
    -- Retornar al final del día hábil (23:59:59)
    RETURN v_fecha_actual + INTERVAL '23 hours 59 minutes 59 seconds';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_fecha_vencimiento IS 'Calcula fecha de vencimiento considerando días hábiles y feriados';

-- ============================================================================
-- TRIGGER: Actualizar fecha_actualizacion en plazos
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_actualizar_fecha_plazos ON plazos_procesales;
CREATE TRIGGER trigger_actualizar_fecha_plazos
    BEFORE UPDATE ON plazos_procesales
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

-- ============================================================================
-- VISTA: Plazos próximos a vencer (para alertas)
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
    -- Días restantes
    EXTRACT(DAY FROM (p.fecha_vencimiento - NOW())) AS dias_restantes,
    -- Nivel de urgencia
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
SELECT 'Sprint 3: Esquema de base de datos creado correctamente' AS resultado;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('decisiones_judiciales', 'historial_decisiones', 
                   'notificaciones_procesales', 'plazos_procesales',
                   'catalogo_tipos_actuacion', 'dias_inhabiles');
