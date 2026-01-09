-- ============================================================================
-- SPRINT 3 - Agregar identificaciones a las partes procesales
-- Para HU-SJ-004: Notificaciones procesales con datos completos
-- ============================================================================

\c db_casos;

-- Actualizar causas existentes con identificaciones de prueba
UPDATE causas SET
  actor_nombre = COALESCE(actor_nombre, 'Juan Carlos Pérez López'),
  actor_identificacion = '1712345678',
  demandado_nombre = COALESCE(demandado_nombre, 'María Elena García Ruiz'),
  demandado_identificacion = '1798765432'
WHERE causa_id = 1;

UPDATE causas SET
  actor_nombre = COALESCE(actor_nombre, 'Pedro Antonio Mendoza'),
  actor_identificacion = '1723456789',
  demandado_nombre = COALESCE(demandado_nombre, 'Carmen Lucía Torres'),
  demandado_identificacion = '1787654321'
WHERE causa_id = 2;

UPDATE causas SET
  actor_nombre = COALESCE(actor_nombre, 'Luis Fernando Ortega'),
  actor_identificacion = '1734567890',
  demandado_nombre = COALESCE(demandado_nombre, 'Ana Patricia Morales'),
  demandado_identificacion = '1776543210'
WHERE causa_id = 3;

UPDATE causas SET
  actor_nombre = COALESCE(actor_nombre, 'Roberto Carlos Jiménez'),
  actor_identificacion = '1745678901',
  demandado_nombre = COALESCE(demandado_nombre, 'Diana Carolina Suárez'),
  demandado_identificacion = '1765432109'
WHERE causa_id = 4;

UPDATE causas SET
  actor_nombre = COALESCE(actor_nombre, 'Francisco Javier Ramírez'),
  actor_identificacion = '1756789012',
  demandado_nombre = COALESCE(demandado_nombre, 'Patricia Elizabeth Vargas'),
  demandado_identificacion = '1754321098'
WHERE causa_id = 5;

UPDATE causas SET
  actor_nombre = COALESCE(actor_nombre, 'Miguel Ángel Castillo'),
  actor_identificacion = '1767890123',
  demandado_nombre = COALESCE(demandado_nombre, 'Gabriela María Herrera'),
  demandado_identificacion = '1743210987'
WHERE causa_id = 6;

UPDATE causas SET
  actor_nombre = COALESCE(actor_nombre, 'Carlos Eduardo Salazar'),
  actor_identificacion = '1778901234',
  demandado_nombre = COALESCE(demandado_nombre, 'Rosa Inés Delgado'),
  demandado_identificacion = '1732109876'
WHERE causa_id = 7;

UPDATE causas SET
  actor_nombre = COALESCE(actor_nombre, 'Jorge Alberto Núñez'),
  actor_identificacion = '1789012345',
  demandado_nombre = COALESCE(demandado_nombre, 'Silvia Fernanda Reyes'),
  demandado_identificacion = '1721098765'
WHERE causa_id = 8;

-- Para cualquier otra causa que no tenga identificaciones
UPDATE causas SET
  actor_identificacion = '17' || LPAD((random() * 99999999)::int::text, 8, '0'),
  demandado_identificacion = '17' || LPAD((random() * 99999999)::int::text, 8, '0')
WHERE actor_identificacion IS NULL OR demandado_identificacion IS NULL;

-- Verificar los datos actualizados
SELECT 
  causa_id,
  numero_proceso,
  actor_nombre,
  actor_identificacion,
  demandado_nombre,
  demandado_identificacion
FROM causas
ORDER BY causa_id
LIMIT 10;

DO $$
BEGIN
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'IDENTIFICACIONES AGREGADAS CORRECTAMENTE';
  RAISE NOTICE '===================================================';
END $$;
