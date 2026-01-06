# Control de Acceso Sprint 2 - HU-JZ-001

## 📋 Resumen

Implementación del control de acceso basado en atributos (FIA_ATD.1) para garantizar que los jueces solo puedan acceder a los expedientes y recursos de las causas que tienen asignadas.

## 🎯 Objetivo

**HU-JZ-001**: Que un juez no vea expedientes de otro juez (FIA_ATD.1 - User attribute definition)

## 🔐 Implementación

### Archivo principal: `access-control.middleware.ts`

Este middleware intercepta las solicitudes y verifica la propiedad de los recursos antes de permitir el acceso.

### Middlewares creados:

#### 1. `verificarPropiedadCausa(paramName)`
- **Propósito**: Valida que el juez tenga acceso a una causa específica
- **Uso**: `GET /api/causas/:id`, `GET /api/causas/:id/expediente`
- **Lógica**:
  1. Extrae `funcionarioId` del token JWT
  2. Consulta `juez_asignado_id` de la tabla `causas`
  3. Si no coinciden → **403 Forbidden** + registro en auditoría con severidad ALTA
  4. Si coinciden → Permite acceso y registra evento

#### 2. `verificarPropiedadDocumento(documentoParamName)`
- **Propósito**: Valida que el documento pertenezca a una causa asignada al juez
- **Uso**: `GET /api/documentos/:id`
- **Lógica**:
  1. Obtiene el `causa_id` del documento
  2. Consulta el `juez_asignado_id` de esa causa
  3. Valida propiedad y registra en auditoría

#### 3. `verificarPropiedadAudiencia(audienciaParamName)`
- **Propósito**: Valida que la audiencia pertenezca a una causa asignada al juez
- **Uso**: `PATCH /api/audiencias/:id/estado`, `PATCH /api/audiencias/:id/reprogramar`
- **Lógica**: Similar a documentos, valida a través de la causa relacionada

## 📊 Flujo de Control

```
┌─────────────────┐
│  Cliente        │
│  (Juez)         │
└────────┬────────┘
         │ GET /api/causas/123 + JWT
         │
         ▼
┌─────────────────────────────┐
│  authenticate()             │ ← Valida JWT
│  - Extrae funcionarioId     │
│  - Valida token             │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  authorize("JUEZ")          │ ← Valida rol
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  verificarPropiedadCausa()  │ ← NUEVO Sprint 2
│  1. Query db_casos          │
│  2. SELECT juez_asignado_id │
│  3. Comparar con JWT        │
└────────┬────────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 ✅ OK     ❌ DENY
    │         │
    │         ├─► Log en db_logs (ALTA severidad)
    │         ├─► Alerta en consola
    │         └─► 403 Forbidden
    │
    ▼
┌─────────────────────────────┐
│  Controlador                │
│  - Devuelve datos           │
└─────────────────────────────┘
```

## 🔍 Registro de Auditoría

### Acceso Denegado (IDOR detectado)
```typescript
{
  tipoEvento: "ACCESO_DENEGADO",
  usuarioId: 42,
  usuarioCorreo: "juez.perez@judicial.gob.ec",
  moduloAfectado: "CASOS",
  severidad: "ALTA", // ⚠️ Posible ataque IDOR
  descripcion: "Intento de acceso a causa no asignada",
  datosAfectados: {
    causaId: 123,
    numeroProceso: "17281-2026-00123",
    juezAsignadoReal: 15,
    juezIntentandoAcceder: 42,
    ruta: "/api/causas/123",
    metodo: "GET"
  },
  ipOrigen: "192.168.1.100",
  userAgent: "Mozilla/5.0..."
}
```

### Acceso Permitido
```typescript
{
  tipoEvento: "ACCESO_CAUSA",
  usuarioId: 42,
  severidad: "BAJA",
  descripcion: "Acceso autorizado a causa 123",
  ...
}
```

## 📝 Rutas Protegidas

### Causas
- ✅ `GET /api/causas/:id` - Con `verificarPropiedadCausa("id")`
- ✅ `GET /api/causas/:id/expediente` - Con `verificarPropiedadCausa("id")`
- ✅ `GET /api/causas` - Filtro automático por `juezAsignadoId` (en controlador)

### Documentos
- ✅ `GET /api/documentos/:id` - Con `verificarPropiedadDocumento("id")`
- ✅ `GET /api/documentos/causa/:causaId` - Con `verificarPropiedadCausa("causaId")`

### Audiencias
- ✅ `PATCH /api/audiencias/:id/estado` - Con `verificarPropiedadAudiencia("id")`
- ✅ `PATCH /api/audiencias/:id/reprogramar` - Con `verificarPropiedadAudiencia("id")`
- ✅ `GET /api/audiencias` - Filtro automático por `juezId` (en controlador)

## 🛡️ Excepciones

Los roles **ADMIN_CJ** y **SECRETARIO** tienen acceso total y NO se les aplica la verificación de propiedad:

```typescript
if (req.user.rol !== "JUEZ") {
  next(); // Bypass para admins y secretarios
  return;
}
```

## 🔧 Uso en Nuevas Rutas

Para proteger una nueva ruta:

```typescript
import { verificarPropiedadCausa } from "../middleware/access-control.middleware.js";

router.get(
  "/api/mi-ruta/:causaId",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  verificarPropiedadCausa("causaId"), // ← Agregar aquí
  async (req, res, next) => {
    // Tu lógica aquí
  }
);
```

## 📈 Cumplimiento Common Criteria

| Requisito | Implementado | Evidencia |
|-----------|--------------|-----------|
| **FIA_ATD.1** | ✅ | Middleware verifica atributo `juez_asignado_id` |
| **FDP_ACC.1** | ✅ | Control de acceso basado en propiedad del recurso |
| **FAU_GEN.1** | ✅ | Registro completo en auditoría con severidad |
| **FAU_SAR.1** | ✅ | Alertas en consola para monitoreo en tiempo real |

## 🧪 Casos de Prueba

### Caso 1: Acceso permitido
- **Usuario**: Juez ID 42
- **Solicitud**: `GET /api/causas/123`
- **DB**: `juez_asignado_id = 42`
- **Resultado**: ✅ 200 OK + datos de la causa

### Caso 2: Acceso denegado (IDOR)
- **Usuario**: Juez ID 42
- **Solicitud**: `GET /api/causas/456`
- **DB**: `juez_asignado_id = 15`
- **Resultado**: ❌ 403 Forbidden + log con severidad ALTA

### Caso 3: Admin tiene acceso total
- **Usuario**: Admin ID 1 (rol ADMIN_CJ)
- **Solicitud**: `GET /api/causas/456`
- **DB**: `juez_asignado_id = 15`
- **Resultado**: ✅ 200 OK (bypass de verificación)

## 🚀 Próximas Mejoras

- [ ] Agregar rate limiting específico para intentos fallidos de acceso
- [ ] Implementar bloqueo temporal tras N intentos IDOR
- [ ] Dashboard de alertas de seguridad en tiempo real
- [ ] Notificaciones automáticas a ADMIN_CJ en caso de múltiples IDOR
