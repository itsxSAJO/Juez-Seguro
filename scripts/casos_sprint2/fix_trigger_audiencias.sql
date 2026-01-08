-- ============================================================================
-- FIX: Limpieza de trigger de reprogramaciones (YA NO SE USA)
-- La inserción al historial se hace desde el servicio de backend, no con trigger
-- ============================================================================

-- Eliminar trigger y función si existen (ya no se usan)
DROP TRIGGER IF EXISTS trg_audiencia_reprogramacion ON audiencias;
DROP FUNCTION IF EXISTS fn_registrar_reprogramacion_audiencia();

-- NOTA: El historial de reprogramaciones se inserta directamente desde 
-- backend/src/services/audiencias.service.ts -> método reprogramar()
-- Esto permite tener más control sobre los datos insertados (IP, motivo, etc.)

SELECT 'Trigger eliminado - historial se maneja desde backend' as resultado;
