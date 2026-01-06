# Scripts de Base de Datos - Sprint 2

Este directorio contiene los scripts SQL incrementales para el Sprint 2, enfocado en la operativa de expedientes y audiencias.

## 🎯 Objetivo del Sprint 2

Implementar la infraestructura de seguridad para documentos y audiencias cumpliendo con:
- **HU-SJ-002**: Gestión de Documentos del Expediente
- **HU-SJ-003**: Gestión de Audiencias (próximo)
- **Common Criteria**: FDP_IFC.1, FAU_GEN.1

## 📋 Orden de Ejecución

Los scripts se ejecutan automáticamente en orden alfabético cuando se inicializa el contenedor `db_casos`:

1. **`00_reset_schema.sql`** - Limpia el esquema (⚠️ SOLO DESARROLLO)
2. **`01_schema.sql`** - Schema base del Sprint 1
   - Tablas: `causas`, `mapa_pseudonimos`, `expedientes`
   - Índices y constraints básicos
3. **`02_seed_catalogos.sql`** - Datos de catálogos y pseudónimos de desarrollo
4. **`03_update_documentos_sprint2.sql`** - ✨ **NUEVO SPRINT 2**
   - Mejora tabla `documentos` existente
   - Agrega `documentos_versiones` (histórico inmutable)
   - Agrega `documentos_accesos` (auditoría de lectura)
   - Triggers automáticos de versionado
   - Función de verificación de integridad
5. **`04_update_audiencias_sprint2.sql`** - ✨ **NUEVO SPRINT 2**
   - Mejora tabla `audiencias` existente
   - Agrega `audiencias_historial_reprogramaciones` (trazabilidad de cambios)
   - Agrega `audiencias_asistentes` (control de participantes)
   - Agrega `audiencias_notificaciones` (tracking de notificaciones)
   - Trigger automático de historial de reprogramaciones
   - Funciones para validación de disponibilidad de sala

## 🔐 Características de Seguridad Implementadas

### 📄 Documentos (Sprint 2)

#### Integridad (FDP_IFC.1)
- ✅ Hash SHA-256 obligatorio para cada documento
- ✅ Histórico inmutable de versiones
- ✅ Función de verificación de integridad: `fn_verificar_integridad_documento()`
- ✅ Trigger automático de versionado en actualizaciones

#### Trazabilidad (FAU_GEN.1)
- ✅ Tabla `documentos_accesos` para auditoría de lectura
- ✅ Registro de fecha, usuario, IP y tipo de acceso
- ✅ Tracking de intentos fallidos con motivo de rechazo

#### Validación
- ✅ Whitelist de tipos MIME: solo `application/pdf`
- ✅ Constraints de tipo de documento
- ✅ Campos obligatorios de seguridad

### 📅 Audiencias (Sprint 2)

#### Historial Inmutable (FAU_GEN.1)
- ✅ Tabla `audiencias_historial_reprogramaciones` para rastrear todos los cambios
- ✅ Trigger automático que registra cada reprogramación
- ✅ Registro de motivo obligatorio para cada cambio
- ✅ Tracking de quién, cuándo y desde dónde se modifica

#### Control de Asistentes
- ✅ Tabla `audiencias_asistentes` para gestionar participantes
- ✅ Tipos: JUEZ, SECRETARIO, FISCAL, ACTOR, DEMANDADO, ABOGADO, TESTIGO, PERITO
- ✅ Control de confirmación y asistencia real
- ✅ Registro de hora de entrada/salida

#### Sistema de Notificaciones
- ✅ Tabla `audiencias_notificaciones` para tracking completo
- ✅ Estados: PENDIENTE, ENVIADA, ENTREGADA, FALLIDA, LEIDA
- ✅ Múltiples métodos: EMAIL, SMS, FISICO, SISTEMA
- ✅ Registro de intentos y errores

#### Validaciones
- ✅ Función `fn_verificar_disponibilidad_sala()` para evitar conflictos
- ✅ Modalidades: PRESENCIAL, VIRTUAL, HIBRIDA
- ✅ Gestión de enlaces de videoconferencia

### Almacenamiento Físico (WORM)

⚠️ **IMPORTANTE**: Los archivos PDF NO se almacenan en PostgreSQL

- Los PDFs se guardan en: `/app/storage/expedientes_seguros` (volumen Docker)
- La BD solo guarda: metadatos, rutas y hashes
- Modelo WORM (Write Once Read Many) garantiza inmutabilidad

## 📊 Estructura de Tablas

### `documentos` (Principal)
- `id` - UUID del documento
- `causa_id` - FK a causas
- `hash_sha256` - Hash de integridad (64 chars)
- `ruta_almacenamiento` - Path en volumen seguro
- `tipo` - ESCRITO, PROVIDENCIA, SENTENCIA, OTRO
- `parte_presentante` - Quién lo presenta
- `subido_por_secretario_id` - Quién lo cargó
- `tamanio_bytes`, `mime_type`, `estado`

### `documentos_versiones` (Histórico)
- `version_id` - PK autoincremental
- `documento_id` - FK a documentos
- `hash_sha256`, `ruta_almacenamiento`, `tamanio_bytes`
- `version_numero` - Secuencial (1, 2, 3...)
- `motivo_cambio` - Por qué se actualizó
- `modificado_por_secretario_id`

### `documentos_accesos` (Auditoría)
- `acceso_id` - PK autoincremental
- `documento_id` - FK a documentos
- `usuario_id`, `rol_usuario`
- `fecha_acceso`, `ip_address`
- `tipo_acceso` - LECTURA, DESCARGA, VISUALIZACION
- `exitoso`, `motivo_rechazo`

### `audiencias_historial_reprogramaciones` (Trazabilidad)
- `historial_id` - PK autoincremental
- `audiencia_id` - FK a audiencias
- `fecha_hora_anterior`, `sala_anterior`
- `fecha_hora_nueva`, `sala_nueva`
- `motivo_reprogramacion` - Justificación obligatoria
- `tipo_cambio` - REPROGRAMACION, CANCELACION, CAMBIO_SALA
- `modificado_por_secretario_id`, `modificado_por_rol`
- `fecha_modificacion`, `ip_modificacion`
- `estado_anterior`, `estado_nuevo`

### `audiencias_asistentes` (Control de Participantes)
- `asistente_id` - PK autoincremental
- `audiencia_id` - FK a audiencias
- `tipo_asistente` - JUEZ, SECRETARIO, FISCAL, ACTOR, DEMANDADO, etc.
- `persona_id`, `nombre_completo`, `rol_especifico`
- `confirmacion_asistencia`, `asistio`
- `hora_entrada`, `hora_salida`

### `audiencias_notificaciones` (Tracking de Notificaciones)
- `notificacion_id` - PK autoincremental
- `audiencia_id` - FK a audiencias
- `destinatario_tipo`, `destinatario_nombre`, `destinatario_email`
- `estado_notificacion` - PENDIENTE, ENVIADA, ENTREGADA, FALLIDA, LEIDA
- `metodo_envio` - EMAIL, SMS, FISICO, SISTEMA
- `fecha_envio`, `fecha_entrega`, `fecha_lectura`
- `intentos_envio`, `ultimo_error`

## 🚀 Próximos Scripts (En desarrollo)

6. **`05_add_constraints.sql`** - Constraints de integridad referencial adicionales
7. **`06_seed_test_data_sprint2.sql`** - Datos de prueba para Sprint 2

## 🧪 Verificación

Cada script incluye un bloque de verificación al final que valida:
- ✅ Existencia de tablas
- ✅ Existencia de columnas críticas
- ✅ Creación de índices
- ✅ Activación de triggers

Para verificar manualmente:
```sql
-- Ver estructura de documentos
\d+ documentos

-- Ver versiones registradas
SELECT * FROM documentos_versiones ORDER BY fecha_version DESC;

-- Ver accesos auditados
SELECT * FROM documentos_accesos ORDER BY fecha_acceso DESC LIMIT 10;
```

-- Ver historial de reprogramaciones
SELECT * FROM audiencias_historial_reprogramaciones ORDER BY fecha_modificacion DESC;

-- Ver próximas audiencias de una causa
SELECT * FROM fn_obtener_proximas_audiencias(1, 5);

-- Verificar disponibilidad de sala
SELECT fn_verificar_disponibilidad_sala('SALA-1', '2026-01-10 10:00:00'::TIMESTAMPTZ, 120);
