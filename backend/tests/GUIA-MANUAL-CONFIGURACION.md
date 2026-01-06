# Guía Rápida: Configuración Manual de Datos de Prueba

## 🎯 Objetivo
Crear dos causas asignadas a jueces diferentes para probar el control de acceso IDOR.

## 📋 Pasos

### PASO 1: Obtener IDs de Funcionarios Jueces

Abre **pgAdmin** o **psql** y conéctate a `db_usuarios`:

```sql
-- Conectar a db_usuarios
\c db_usuarios;

-- Obtener jueces activos
SELECT 
  funcionario_id,
  nombres || ' ' || apellidos as nombre_completo,
  correo_institucional,
  materia,
  unidad_judicial
FROM funcionarios
WHERE rol = 'JUEZ'
  AND estado = 'ACTIVO'
ORDER BY funcionario_id
LIMIT 10;
```

**Anota dos IDs diferentes:**
- Juez 1 ID: `_______` (ej: 23)
- Juez 2 ID: `_______` (ej: 27)

---

### PASO 2: Crear Causas de Prueba

Abre el archivo: `scripts/casos_sprint2/06_datos_prueba_control_acceso.sql`

**Busca estas líneas (aproximadamente línea 90-100):**

```sql
v_juez1_id := 23;  -- ← CAMBIAR por ID real del primer juez
v_juez2_id := 27;  -- ← CAMBIAR por ID real del segundo juez
```

**Reemplaza con los IDs que anotaste en el PASO 1.**

**Guarda el archivo.**

---

### PASO 3: Ejecutar Script SQL

En **psql** o **pgAdmin**, conéctate a `db_casos`:

```sql
-- Conectar a db_casos
\c db_casos;

-- Ejecutar script (ajusta la ruta si es necesario)
\i 'C:/Users/saidl/Desktop/EPN/8 Semestre/Desarrollo de Software Seguro/Juez-Seguro-Proyecto/Juez-Seguro/scripts/casos_sprint2/06_datos_prueba_control_acceso.sql'
```

**El script mostrará:**
```
===================================================
CAUSAS DE PRUEBA CREADAS
===================================================
Causa Juez 1 (ID=15): Asignada a funcionario 23
Causa Juez 2 (ID=16): Asignada a funcionario 27

ACTUALIZA EN test-hu-jz-001-security.ts:
TEST_DATA.causa_juez1 = 15;
TEST_DATA.causa_juez2 = 16;
```

**Anota los IDs de las causas creadas:**
- Causa Juez 1: `_______`
- Causa Juez 2: `_______`

---

### PASO 4: Actualizar Script de Pruebas

Abre: `backend/tests/test-hu-jz-001-security.ts`

**Busca la sección TEST_DATA (línea ~28-36):**

```typescript
const TEST_DATA = {
  causa_juez1: 0,      // ← ACTUALIZAR con el ID de causa del paso 3
  causa_juez2: 0,      // ← ACTUALIZAR con el ID de causa del paso 3
  documento_juez1: '',
  documento_juez2: '',
  audiencia_juez1: 0,
  audiencia_juez2: 0,
};
```

**Actualiza con los IDs anotados en el PASO 3.**

**Ejemplo:**
```typescript
const TEST_DATA = {
  causa_juez1: 15,     // ← ID de causa creada para Juez 1
  causa_juez2: 16,     // ← ID de causa creada para Juez 2
  documento_juez1: '',
  documento_juez2: '',
  audiencia_juez1: 0,
  audiencia_juez2: 0,
};
```

**Busca la sección CREDENTIALS (línea ~39-50):**

```typescript
const CREDENTIALS = {
  juez1: {
    correo: 'juez1@judicial.gob.ec',     // ← CAMBIAR
    password: 'Password123!',             // ← CAMBIAR
  },
  juez2: {
    correo: 'juez2@judicial.gob.ec',     // ← CAMBIAR
    password: 'Password123!',             // ← CAMBIAR
  },
  admin: {
    correo: 'admin@judicial.gob.ec',
    password: 'AdminPass123!',
  },
};
```

**Actualiza con las credenciales reales:**
```typescript
const CREDENTIALS = {
  juez1: {
    correo: 'damaris.suquillo@judicatura.gob.ec',
    password: 'Ep2@YQBgFLUT',
  },
  juez2: {
    correo: 'said.luna01@judicatura.gob.ec',
    password: 'xBs7*6yVw$!B',
  },
  admin: {
    correo: 'damaris.suquillo@judicatura.gob.ec',  // Temporal, usar como admin
    password: 'Ep2@YQBgFLUT',
  },
};
```

**Guarda el archivo.**

---

### PASO 5: Verificar que los Jueces Tengan Causas Diferentes

En **psql** (`db_casos`):

```sql
-- Verificar que las causas estén asignadas a jueces diferentes
SELECT 
  c.causa_id,
  c.numero_proceso,
  c.juez_asignado_id,
  c.materia,
  c.descripcion_pseudonimizada
FROM causas c
WHERE c.descripcion_pseudonimizada LIKE '%Control de Acceso%'
ORDER BY c.causa_id DESC;
```

**Resultado esperado:**
```
causa_id | numero_proceso     | juez_asignado_id | materia
---------|-------------------|------------------|--------
16       | 17355-2026-00015  | 27               | PENAL
15       | 17355-2026-00014  | 23               | CIVIL
```

✅ **Confirma que cada causa tiene diferente `juez_asignado_id`**

---

### PASO 6: Ejecutar Pruebas

En PowerShell desde `backend/`:

```bash
npx tsx tests/test-hu-jz-001-security.ts
```

---

## ✅ Resultado Esperado

```
================================================================================
📋 PRUEBA: FIA_ATD.1 - Acceso Denegado a Causa Ajena (IDOR)
================================================================================
ℹ️  Juez 1 intenta acceder a causa 16 del Juez 2
✅ Acceso denegado correctamente (403 Forbidden)
✅ Código: FORBIDDEN_RESOURCE
✅ Mensaje: No tiene autorización para acceder a esta causa
ℹ️  ✓ Debe existir log en db_logs con severidad ALTA
```

---

## 🔍 Verificar Logs de Auditoría

En **psql** (`db_logs`):

```sql
\c db_logs;

-- Ver últimos accesos denegados
SELECT 
  log_id,
  fecha_evento,
  tipo_evento,
  usuario_correo,
  descripcion_evento,
  datos_afectados::jsonb->>'causaId' as causa_id,
  datos_afectados::jsonb->>'juezAsignadoReal' as juez_real,
  datos_afectados::jsonb->>'juezIntentandoAcceder' as juez_intruso
FROM logs_auditoria
WHERE tipo_evento = 'ACCESO_DENEGADO'
  AND modulo_afectado = 'CASOS'
ORDER BY fecha_evento DESC
LIMIT 5;
```

**Deberías ver registros de los intentos de acceso bloqueados.**

---

## 🔐 Al Finalizar

**IMPORTANTE**: Restaura las credenciales de ejemplo en el archivo de pruebas para no commitear credenciales reales:

```typescript
const CREDENTIALS = {
  juez1: {
    correo: 'juez1@judicial.gob.ec',
    password: 'Password123!',
  },
  juez2: {
    correo: 'juez2@judicial.gob.ec',
    password: 'Password123!',
  },
  admin: {
    correo: 'admin@judicial.gob.ec',
    password: 'AdminPass123!',
  },
};
```

---

## 📌 Resumen

1. ✅ Obtener IDs de 2 jueces diferentes de `db_usuarios`
2. ✅ Editar y ejecutar `06_datos_prueba_control_acceso.sql`
3. ✅ Actualizar `TEST_DATA` y `CREDENTIALS` en el script de pruebas
4. ✅ Ejecutar pruebas con `npx tsx tests/test-hu-jz-001-security.ts`
5. ✅ Verificar logs en `db_logs`
6. ✅ Restaurar credenciales de ejemplo

**Duración estimada**: 5-10 minutos
