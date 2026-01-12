# 🔐 SEGURIDAD - Logger Estructurado (FAU)

## 📋 Resumen del Cambio

**Tarea**: 🟡 Media - Reemplazar console.logs con logger estructurado

**Estado**: ✅ COMPLETADO

**Fecha**: 2026-01-12

---

## 🎯 Objetivo

Implementar un sistema de logging estructurado que cumpla con los requisitos de:
- **FAU (Auditoría de Seguridad)**: Registros estructurados para análisis forense
- **Common Criteria**: Trazabilidad completa de eventos del sistema
- **Producción**: Formato JSON parseable para herramientas de log aggregation (ELK, Splunk, etc.)

---

## 🏗️ Implementación

### Nuevo Servicio: `logger.service.ts`

Ubicación: `backend/src/services/logger.service.ts`

**Características**:

1. **Niveles de Log**: `error`, `warn`, `info`, `debug`
2. **Sanitización Automática**: Oculta datos sensibles (password, token, secret, key, auth, credential, cookie, session)
3. **Formato JSON en Producción**: Estructurado y parseable
4. **Formato Coloreado en Desarrollo**: Legible para humanos
5. **19 Módulos Predefinidos**:
   - `auth`, `usuarios`, `causas`, `documentos`, `audiencias`
   - `notificaciones`, `firma`, `pki`, `secrets`, `audit`
   - `email`, `plazos`, `alertas`, `rateLimit`, `security`
   - `db`, `server`, `system`

### Ejemplo de Output (Production)

```json
{
  "timestamp": "2026-01-12T05:28:23.195Z",
  "level": "info",
  "module": "SYSTEM",
  "message": "🚀 Iniciando Juez Seguro Backend..."
}
```

```json
{
  "timestamp": "2026-01-12T05:28:23.253Z",
  "level": "info",
  "module": "SECRETS",
  "message": "6 secretos cargados en caché"
}
```

```json
{
  "timestamp": "2026-01-12T05:28:23.280Z",
  "level": "error",
  "module": "SYSTEM",
  "message": "Error en escaneo:",
  "data": {
    "errorMessage": "relation \"plazos_procesales\" does not exist",
    "errorStack": "..."
  }
}
```

---

## 📝 Archivos Modificados

### Servicios

| Archivo | Módulo Logger |
|---------|---------------|
| `secrets-manager.service.ts` | `secrets` |
| `firma.service.ts` | `firma` |
| `pki.service.ts` | `pki` |
| `email.service.ts` | `email` |
| `usuarios.service.ts` | `usuarios` |
| `alertas.service.ts` | `alertas` |
| `notificaciones-procesales.service.ts` | `notificaciones` |
| `decisiones.service.ts` | `documentos` |
| `documentos.service.ts` | `documentos` |
| `causas.service.ts` | `causas` |
| `audiencias.service.ts` | `audiencias` |

### Middleware

| Archivo | Módulo Logger |
|---------|---------------|
| `auth.middleware.ts` | `auth` |
| `audit-interceptor.middleware.ts` | `audit` |
| `access-control.middleware.ts` | `security` |
| `publicRateLimiter.ts` | `rateLimit`, `security` |

### Rutas

| Archivo | Módulo Logger |
|---------|---------------|
| `auth.routes.ts` | `auth` |
| `decisiones.routes.ts` | `documentos` |
| `publico.routes.ts` | `security` |

### Otros

| Archivo | Módulo Logger |
|---------|---------------|
| `index.ts` | `system` |
| `db/connection.ts` | `db` |

---

## 🔒 Sanitización de Datos Sensibles

El logger automáticamente oculta valores de campos sensibles:

```typescript
const SENSITIVE_KEYS = [
  "password", "token", "secret", "key", "auth", 
  "credential", "cookie", "session"
];
```

**Ejemplo**:
```javascript
// Input
log.info("Usuario autenticado", { password: "secreto123", userId: 1 });

// Output
{"level":"info","module":"AUTH","message":"Usuario autenticado","data":{"password":"[REDACTED]","userId":1}}
```

---

## 🚀 Uso del Logger

### Importación

```typescript
import { loggers } from "./services/logger.service.js";

const log = loggers.auth; // Usar el módulo correspondiente
```

### Métodos Disponibles

```typescript
log.info("Mensaje informativo");
log.info("Con datos", { userId: 1, action: "login" });
log.warn("Advertencia");
log.error("Error crítico", error);
log.debug("Detalle de depuración");
```

---

## ✅ Verificación

### Antes (console.log sin estructura)

```
[ERROR] 2026-01-12T05:18:39.107Z: Error desencriptando secreto JWT_SECRET
```

### Después (JSON estructurado)

```json
{
  "timestamp": "2026-01-12T05:28:23.249Z",
  "level": "error",
  "module": "SECRETS",
  "message": "❌ Error desencriptando secreto JWT_SECRET",
  "data": {
    "error": "Error: Unsupported state or unable to authenticate data"
  }
}
```

---

## 📊 Beneficios

1. **Análisis Automatizado**: Los logs JSON pueden ser procesados por herramientas como ELK Stack, Splunk, Datadog
2. **Trazabilidad**: Cada log incluye timestamp preciso y módulo de origen
3. **Seguridad**: Datos sensibles automáticamente redactados
4. **Filtrado**: Fácil filtrar por nivel (error, warn, info) o módulo
5. **Correlación**: El campo `module` permite agrupar logs relacionados
6. **Cumplimiento FAU**: Registros estructurados para auditoría de seguridad

---

## 🔍 Verificación Post-Implementación

```bash
# Ver logs estructurados del backend
docker logs juez_seguro_backend_api

# Filtrar solo errores
docker logs juez_seguro_backend_api 2>&1 | grep '"level":"error"'

# Filtrar por módulo
docker logs juez_seguro_backend_api 2>&1 | grep '"module":"SECRETS"'
```

---

## 📌 Notas Importantes

1. Los únicos `console.log` restantes están en `logger.service.ts` (intencional - es donde realmente se hace el output)
2. El logger detecta automáticamente el ambiente (`NODE_ENV`) para formatear la salida
3. En desarrollo muestra colores y formato legible
4. En producción muestra JSON puro para máquinas
