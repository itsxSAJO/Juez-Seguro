-- ============================================================================
-- JUEZ SEGURO - Sprint 2: Actualización de Audiencias con Trazabilidad
-- HU-SJ-003: Gestión de Audiencias
-- HU-JZ-002: Agenda del Juez
-- ============================================================================
-- Common Criteria: FDP_IFC.1, FAU_GEN.1
-- Propósito: Trazabilidad completa de reprogramaciones y asistentes
-- ============================================================================

-- ============================================================================
-- PASO 1: Mejorar tabla existente de audiencias
-- ============================================================================

-- Separar fecha y hora en un solo campo TIMESTAMP para mejor manejo
ALTER TABLE audiencias 
    ADD COLUMN IF NOT EXISTS fecha_hora_programada TIMESTAMPTZ;

-- Migrar datos existentes (si hay)
UPDATE audiencias 
SET fecha_hora_programada = (fecha::TEXT || ' ' || hora::TEXT)::TIMESTAMPTZ
WHERE fecha_hora_programada IS NULL AND fecha IS NOT NULL AND hora IS NOT NULL;

-- Agregar campos adicionales para Sprint 2
ALTER TABLE audiencias 
    ADD COLUMN IF NOT EXISTS sala VARCHAR(50),
    ADD COLUMN IF NOT EXISTS tipo_audiencia VARCHAR(100),
    ADD COLUMN IF NOT EXISTS modalidad VARCHAR(20) DEFAULT 'PRESENCIAL',
    ADD COLUMN IF NOT EXISTS enlace_videoconferencia VARCHAR(500),
    ADD COLUMN IF NOT EXISTS acta_audiencia TEXT,
    ADD COLUMN IF NOT EXISTS resultado VARCHAR(100),
    ADD COLUMN IF NOT EXISTS duracion_minutos INTEGER;

-- Actualizar tipos de audiencia para incluir más casos
ALTER TABLE audiencias 
    DROP CONSTRAINT IF EXISTS chk_estado_audiencia;

ALTER TABLE audiencias 
    ADD CONSTRAINT chk_estado_audiencia 
    CHECK (estado IN ('PROGRAMADA', 'REALIZADA', 'CANCELADA', 'REPROGRAMADA', 'EN_CURSO', 
                     'programada', 'realizada', 'reprogramada', 'cancelada'));

-- Agregar constraint para modalidad
ALTER TABLE audiencias 
    ADD CONSTRAINT chk_modalidad_audiencia 
    CHECK (modalidad IN ('PRESENCIAL', 'VIRTUAL', 'HIBRIDA'));

-- Agregar campos de auditoría
ALTER TABLE audiencias 
    ADD COLUMN IF NOT EXISTS creado_por_secretario_id INTEGER,
    ADD COLUMN IF NOT EXISTS notificado_partes BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fecha_notificacion TIMESTAMPTZ;

-- Renombrar columnas para consistencia
ALTER TABLE audiencias 
    RENAME COLUMN tipo TO tipo_audiencia_old;

ALTER TABLE audiencias 
    RENAME COLUMN tipo_audiencia TO tipo;

-- Actualizar índices
DROP INDEX IF EXISTS idx_audiencias_fecha;
CREATE INDEX IF NOT EXISTS idx_audiencias_fecha_hora ON audiencias(fecha_hora_programada);
CREATE INDEX IF NOT EXISTS idx_audiencias_sala ON audiencias(sala);
CREATE INDEX IF NOT EXISTS idx_audiencias_modalidad ON audiencias(modalidad);
CREATE INDEX IF NOT EXISTS idx_audiencias_creador ON audiencias(creado_por_secretario_id);

-- ============================================================================
-- PASO 2: Tabla de historial de reprogramaciones (Trazabilidad)
-- CRÍTICO: Auditoría de cambios para cumplir con no repudio
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
    tipo_cambio VARCHAR(30) NOT NULL CHECK (tipo_cambio IN ('REPROGRAMACION', 'CANCELACION', 'CAMBIO_SALA')),
    
    -- Auditoría de quien realiza el cambio
    modificado_por_secretario_id INTEGER NOT NULL,
    modificado_por_rol VARCHAR(50) NOT NULL,
    
    -- Metadatos
    fecha_modificacion TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ip_modificacion VARCHAR(45),
    
    -- Estado resultante
    estado_anterior VARCHAR(30),
    estado_nuevo VARCHAR(30)
);

CREATE INDEX IF NOT EXISTS idx_historial_audiencia ON audiencias_historial_reprogramaciones(audiencia_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha_mod ON audiencias_historial_reprogramaciones(fecha_modificacion);
CREATE INDEX IF NOT EXISTS idx_historial_modificador ON audiencias_historial_reprogramaciones(modificado_por_secretario_id);

COMMENT ON TABLE audiencias_historial_reprogramaciones IS 'Historial inmutable de reprogramaciones de audiencias (FAU_GEN.1)';
COMMENT ON COLUMN audiencias_historial_reprogramaciones.motivo_reprogramacion IS 'Justificación obligatoria del cambio';
COMMENT ON COLUMN audiencias_historial_reprogramaciones.tipo_cambio IS 'Tipo de modificación realizada';

-- ============================================================================
-- PASO 3: Tabla de asistentes a audiencias
-- Registra quiénes participan: jueces, secretarios, partes procesales, abogados
-- ============================================================================

CREATE TABLE IF NOT EXISTS audiencias_asistentes (
    asistente_id SERIAL PRIMARY KEY,
    audiencia_id INTEGER NOT NULL REFERENCES audiencias(audiencia_id) ON DELETE CASCADE,
    
    -- Identificación del asistente
    tipo_asistente VARCHAR(30) NOT NULL CHECK (tipo_asistente IN 
        ('JUEZ', 'SECRETARIO', 'FISCAL', 'ACTOR', 'DEMANDADO', 'ABOGADO_ACTOR', 'ABOGADO_DEMANDADO', 'TESTIGO', 'PERITO')),
    
    -- Datos del asistente
    persona_id INTEGER, -- Puede ser funcionario_id o parte_procesal_id según el caso
    nombre_completo VARCHAR(255) NOT NULL,
    rol_especifico VARCHAR(100), -- Ej: "Abogado Defensor", "Perito Médico"
    
    -- Control de asistencia
    confirmacion_asistencia BOOLEAN DEFAULT FALSE,
    fecha_confirmacion TIMESTAMPTZ,
    asistio BOOLEAN, -- NULL hasta que termine la audiencia
    hora_entrada TIMESTAMPTZ,
    hora_salida TIMESTAMPTZ,
    
    -- Observaciones
    observaciones TEXT,
    
    -- Auditoría
    fecha_registro TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    registrado_por_secretario_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_asistentes_audiencia ON audiencias_asistentes(audiencia_id);
CREATE INDEX IF NOT EXISTS idx_asistentes_tipo ON audiencias_asistentes(tipo_asistente);
CREATE INDEX IF NOT EXISTS idx_asistentes_persona ON audiencias_asistentes(persona_id);

COMMENT ON TABLE audiencias_asistentes IS 'Registro de participantes en audiencias';
COMMENT ON COLUMN audiencias_asistentes.asistio IS 'NULL=pendiente, TRUE=asistió, FALSE=no asistió';

-- ============================================================================
-- PASO 4: Tabla de notificaciones de audiencias
-- Track de notificaciones enviadas a las partes
-- ============================================================================

CREATE TABLE IF NOT EXISTS audiencias_notificaciones (
    notificacion_id SERIAL PRIMARY KEY,
    audiencia_id INTEGER NOT NULL REFERENCES audiencias(audiencia_id) ON DELETE CASCADE,
    
    -- A quién se notifica
    destinatario_tipo VARCHAR(30) NOT NULL CHECK (destinatario_tipo IN 
        ('ACTOR', 'DEMANDADO', 'ABOGADO', 'TESTIGO', 'PERITO')),
    destinatario_nombre VARCHAR(255) NOT NULL,
    destinatario_email VARCHAR(255),
    destinatario_telefono VARCHAR(20),
    
    -- Estado de la notificación
    estado_notificacion VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE' 
        CHECK (estado_notificacion IN ('PENDIENTE', 'ENVIADA', 'ENTREGADA', 'FALLIDA', 'LEIDA')),
    
    -- Metadatos de envío
    metodo_envio VARCHAR(20) CHECK (metodo_envio IN ('EMAIL', 'SMS', 'FISICO', 'SISTEMA')),
    fecha_envio TIMESTAMPTZ,
    fecha_entrega TIMESTAMPTZ,
    fecha_lectura TIMESTAMPTZ,
    
    -- Contenido
    contenido_notificacion TEXT,
    
    -- Auditoría
    fecha_creacion TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    intentos_envio INTEGER DEFAULT 0,
    ultimo_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_notif_audiencia ON audiencias_notificaciones(audiencia_id);
CREATE INDEX IF NOT EXISTS idx_notif_estado ON audiencias_notificaciones(estado_notificacion);
CREATE INDEX IF NOT EXISTS idx_notif_destinatario ON audiencias_notificaciones(destinatario_email);

COMMENT ON TABLE audiencias_notificaciones IS 'Trazabilidad de notificaciones de audiencias';

-- ============================================================================
-- PASO 5: Trigger automático para registrar reprogramaciones
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_registrar_reprogramacion_audiencia()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo registrar si cambió la fecha/hora o la sala
    IF (OLD.fecha_hora_programada IS DISTINCT FROM NEW.fecha_hora_programada) OR 
       (OLD.sala IS DISTINCT FROM NEW.sala) OR
       (OLD.estado IS DISTINCT FROM NEW.estado AND NEW.estado IN ('REPROGRAMADA', 'CANCELADA', 'reprogramada', 'cancelada')) THEN
        
        INSERT INTO audiencias_historial_reprogramaciones (
            audiencia_id,
            fecha_hora_anterior,
            sala_anterior,
            fecha_hora_nueva,
            sala_nueva,
            motivo_reprogramacion,
            tipo_cambio,
            modificado_por_secretario_id,
            modificado_por_rol,
            estado_anterior,
            estado_nuevo
        ) VALUES (
            NEW.audiencia_id,
            COALESCE(OLD.fecha_hora_programada, OLD.fecha::TIMESTAMPTZ),
            OLD.sala,
            COALESCE(NEW.fecha_hora_programada, NEW.fecha::TIMESTAMPTZ),
            NEW.sala,
            COALESCE(NEW.notas, 'Cambio registrado automáticamente'),
            CASE 
                WHEN NEW.estado IN ('CANCELADA', 'cancelada') THEN 'CANCELACION'
                WHEN OLD.sala IS DISTINCT FROM NEW.sala THEN 'CAMBIO_SALA'
                ELSE 'REPROGRAMACION'
            END,
            COALESCE(NEW.creado_por_secretario_id, 0), -- 0 = sistema
            'SECRETARIO',
            OLD.estado,
            NEW.estado
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trg_audiencia_reprogramacion ON audiencias;
CREATE TRIGGER trg_audiencia_reprogramacion
    AFTER UPDATE ON audiencias
    FOR EACH ROW
    WHEN (OLD.fecha_hora_programada IS DISTINCT FROM NEW.fecha_hora_programada OR 
          OLD.sala IS DISTINCT FROM NEW.sala OR 
          OLD.estado IS DISTINCT FROM NEW.estado)
    EXECUTE FUNCTION fn_registrar_reprogramacion_audiencia();

-- ============================================================================
-- PASO 6: Funciones auxiliares para gestión de audiencias
-- ============================================================================

-- Función para validar disponibilidad de sala
CREATE OR REPLACE FUNCTION fn_verificar_disponibilidad_sala(
    p_sala VARCHAR(50),
    p_fecha_hora TIMESTAMPTZ,
    p_duracion_minutos INTEGER DEFAULT 60,
    p_audiencia_id_excluir INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_conflictos INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_conflictos
    FROM audiencias
    WHERE sala = p_sala
      AND estado IN ('PROGRAMADA', 'programada', 'EN_CURSO')
      AND audiencia_id != COALESCE(p_audiencia_id_excluir, -1)
      AND fecha_hora_programada IS NOT NULL
      AND (
          -- La nueva audiencia empieza durante una existente
          (p_fecha_hora >= fecha_hora_programada AND 
           p_fecha_hora < fecha_hora_programada + INTERVAL '1 minute' * COALESCE(duracion_minutos, 60))
          OR
          -- La nueva audiencia termina durante una existente
          (p_fecha_hora + INTERVAL '1 minute' * p_duracion_minutos > fecha_hora_programada AND
           p_fecha_hora + INTERVAL '1 minute' * p_duracion_minutos <= fecha_hora_programada + INTERVAL '1 minute' * COALESCE(duracion_minutos, 60))
          OR
          -- La nueva audiencia engloba una existente
          (p_fecha_hora <= fecha_hora_programada AND
           p_fecha_hora + INTERVAL '1 minute' * p_duracion_minutos >= fecha_hora_programada + INTERVAL '1 minute' * COALESCE(duracion_minutos, 60))
      );
    
    RETURN (v_conflictos = 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_verificar_disponibilidad_sala IS 'Verifica si una sala está disponible en la fecha/hora especificada';

-- Función para obtener próximas audiencias de una causa
CREATE OR REPLACE FUNCTION fn_obtener_proximas_audiencias(
    p_causa_id INTEGER,
    p_limite INTEGER DEFAULT 10
)
RETURNS TABLE (
    audiencia_id INTEGER,
    fecha_hora_programada TIMESTAMPTZ,
    tipo VARCHAR,
    sala VARCHAR,
    estado VARCHAR,
    cantidad_asistentes BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.audiencia_id,
        COALESCE(a.fecha_hora_programada, a.fecha::TIMESTAMPTZ) as fecha_hora_programada,
        COALESCE(a.tipo, a.tipo_audiencia_old) as tipo,
        a.sala,
        a.estado,
        COUNT(aa.asistente_id) as cantidad_asistentes
    FROM audiencias a
    LEFT JOIN audiencias_asistentes aa ON a.audiencia_id = aa.audiencia_id
    WHERE a.causa_id = p_causa_id
      AND COALESCE(a.fecha_hora_programada, a.fecha::TIMESTAMPTZ) >= NOW()
      AND a.estado IN ('PROGRAMADA', 'programada', 'EN_CURSO')
    GROUP BY a.audiencia_id, a.fecha_hora_programada, a.tipo, a.tipo_audiencia_old, a.sala, a.estado, a.fecha
    ORDER BY fecha_hora_programada ASC
    LIMIT p_limite;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PASO 7: Actualizar comentarios de documentación
-- ============================================================================

COMMENT ON TABLE audiencias IS 'Gestión de audiencias con trazabilidad completa (Sprint 2)';
COMMENT ON COLUMN audiencias.fecha_hora_programada IS 'Fecha y hora de la audiencia (campo unificado Sprint 2)';
COMMENT ON COLUMN audiencias.modalidad IS 'PRESENCIAL, VIRTUAL o HIBRIDA';
COMMENT ON COLUMN audiencias.acta_audiencia IS 'Contenido del acta levantada en la audiencia';
COMMENT ON COLUMN audiencias.resultado IS 'Resultado de la audiencia (ej: Conciliación, Sentencia, Continuación)';

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

DO $$
DECLARE
    v_tablas_nuevas TEXT[];
    v_tabla TEXT;
    v_existe BOOLEAN;
BEGIN
    v_tablas_nuevas := ARRAY['audiencias_historial_reprogramaciones', 'audiencias_asistentes', 'audiencias_notificaciones'];
    
    RAISE NOTICE '=== VERIFICACIÓN DE ESTRUCTURA DE AUDIENCIAS ===';
    
    -- Verificar tabla principal
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audiencias' AND column_name = 'fecha_hora_programada'
    ) INTO v_existe;
    RAISE NOTICE 'Columna audiencias.fecha_hora_programada: %', CASE WHEN v_existe THEN '✓ OK' ELSE '✗ FALTA' END;
    
    -- Verificar tablas nuevas
    FOREACH v_tabla IN ARRAY v_tablas_nuevas
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables WHERE table_name = v_tabla
        ) INTO v_existe;
        RAISE NOTICE 'Tabla %: %', v_tabla, CASE WHEN v_existe THEN '✓ OK' ELSE '✗ FALTA' END;
    END LOOP;
    
    -- Verificar trigger
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audiencia_reprogramacion'
    ) INTO v_existe;
    RAISE NOTICE 'Trigger reprogramación: %', CASE WHEN v_existe THEN '✓ OK' ELSE '✗ FALTA' END;
    
    -- Verificar funciones
    SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'fn_verificar_disponibilidad_sala'
    ) INTO v_existe;
    RAISE NOTICE 'Función verificar_disponibilidad_sala: %', CASE WHEN v_existe THEN '✓ OK' ELSE '✗ FALTA' END;
    
    RAISE NOTICE '=== VERIFICACIÓN COMPLETADA ===';
END $$;
