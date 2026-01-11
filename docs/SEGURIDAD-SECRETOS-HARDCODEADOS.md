# Mitigación de Secretos Hardcodeados (CWE-547)

**Fecha:** 10 de enero de 2026  
**Severidad Original:** 768 (Alta)  
**Herramienta de Detección:** Snyk  
**CWE:** CWE-547 (Use of Hard-coded, Security-relevant Constants)  
**Estado:** ✅ MITIGADO  

---

## 1. Descripción de la Vulnerabilidad

### 1.1 Ubicación
- **Archivo:** `backend/src/config/index.ts`

### 1.2 Código Vulnerable Original

```typescript
export const config = {
  jwt: {
    // ❌ VULNERABILIDAD: Secreto hardcodeado como fallback
    secret: process.env.JWT_SECRET || "change-this-secret-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "30m",
  },
  dbUsers: {
    // ❌ VULNERABILIDAD: Password vacío permitido
    password: process.env.DB_USERS_PASSWORD || "",
  },
  // ... más contraseñas con fallbacks vacíos
};

// Validación solo en producción (insuficiente)
if (config.isProd) {
  if (config.jwt.secret === "change-this-secret-in-production") {
    throw new Error("JWT_SECRET debe ser configurado en producción");
  }
}
```

### 1.3 Riesgos de Seguridad

| Riesgo | Impacto | Probabilidad |
|--------|---------|--------------|
| Secreto comprometido en código fuente | Crítico | Alta |
| Imagen Docker de "dev" desplegada en producción | Crítico | Media |
| Tokens JWT forjados con secreto conocido | Crítico | Alta si se explota |
| Acceso a BD sin autenticación | Crítico | Media |
| Malos hábitos de desarrollo | Alto | Alta |

---

## 2. Solución Implementada

### 2.1 Principios Aplicados

| Principio | Implementación |
|-----------|----------------|
| **Fail Fast** | La aplicación NO arranca sin configuración crítica |
| **Secure by Default** | No existen valores por defecto para secretos |
| **Defense in Depth** | Validación en TODOS los ambientes, no solo producción |
| **Tipado Seguro** | `config.jwt.secret` es `string`, nunca `string \| undefined` |

### 2.2 Funciones de Validación

```typescript
/**
 * Obtiene una variable de entorno OBLIGATORIA.
 * Si no existe, lanza excepción y detiene la aplicación.
 * 
 * @param name - Nombre de la variable
 * @param description - Descripción para el mensaje de error
 * @returns string (nunca undefined)
 * @throws Error si no está definida
 */
function getRequiredEnv(name: string, description?: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `❌ ERROR FATAL: Variable ${name} no definida. ${description || ""}`
    );
  }
  return value;
}

/**
 * Obtiene una variable de entorno OPCIONAL.
 * Usar SOLO para configuraciones no sensibles.
 * NUNCA para secretos o credenciales.
 */
function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}
```

### 2.3 Variables Clasificadas

#### Variables OBLIGATORIAS (sin fallback, fail fast)

| Variable | Descripción | Por qué es obligatoria |
|----------|-------------|------------------------|
| `JWT_SECRET` | Secreto para firmar tokens | Permite forjar tokens si se conoce |
| `DB_USERS_PASSWORD` | Contraseña BD usuarios | Acceso no autorizado a credenciales |
| `DB_CASES_PASSWORD` | Contraseña BD casos | Acceso a información judicial sensible |
| `DB_LOGS_PASSWORD` | Contraseña BD logs | Manipulación de auditoría |
| `PSEUDONIMO_HMAC_SECRET` | Secreto HMAC para pseudónimos | Permite revertir identidad de jueces |

#### Variables OPCIONALES (con fallback seguro)

| Variable | Valor por defecto | Razón |
|----------|-------------------|-------|
| `PORT` | `3000` | No es sensible |
| `NODE_ENV` | `development` | Modo de operación |
| `JWT_EXPIRES_IN` | `30m` | Configuración operacional |
| `DB_*_HOST` | `localhost` | Razonable en desarrollo |
| `BCRYPT_ROUNDS` | `12` | Valor seguro por defecto |

---

## 3. Comportamiento al Faltar Configuración

### 3.1 Mensaje de Error (solo en servidor)

```
╔══════════════════════════════════════════════════════════════════╗
║  ❌ ERROR FATAL DE CONFIGURACIÓN                                 ║
╠══════════════════════════════════════════════════════════════════╣
║  Variable: JWT_SECRET                                            ║
║  (Secreto para firmar tokens JWT)                                ║
╠══════════════════════════════════════════════════════════════════╣
║  La aplicación NO puede iniciar sin esta configuración.         ║
║  Por favor, configúrala en el archivo .env                      ║
╚══════════════════════════════════════════════════════════════════╝
```

### 3.2 Flujo de Validación

```
                    ┌─────────────────┐
                    │  npm run start  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Cargar .env    │
                    └────────┬────────┘
                             │
              ┌──────────────▼──────────────┐
              │  getRequiredEnv("JWT_SECRET") │
              └──────────────┬──────────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                 │
     ┌──────▼──────┐                  ┌───────▼───────┐
     │  Definida?  │───── NO ────────►│  throw Error  │
     └──────┬──────┘                  │  (App muere)  │
            │                         └───────────────┘
           YES
            │
     ┌──────▼──────┐
     │  Continuar  │
     │   inicio    │
     └─────────────┘
```

---

## 4. Configuración del Archivo .env

### 4.1 Plantilla Mínima Requerida

```env
# ============================================================
# JUEZ SEGURO - Variables de Entorno OBLIGATORIAS
# ============================================================

# JWT - OBLIGATORIO: Generar con: openssl rand -base64 64
JWT_SECRET=tu-secreto-super-seguro-aqui-min-32-caracteres

# Base de Datos Usuarios - OBLIGATORIO
DB_USERS_PASSWORD=contraseña-segura-usuarios

# Base de Datos Casos - OBLIGATORIO
DB_CASES_PASSWORD=contraseña-segura-casos

# Base de Datos Logs - OBLIGATORIO
DB_LOGS_PASSWORD=contraseña-segura-logs

# HMAC para Pseudónimos de Jueces - OBLIGATORIO
PSEUDONIMO_HMAC_SECRET=secreto-hmac-para-proteger-identidad-jueces
```

### 4.2 Generación de Secretos Seguros

```bash
# Generar JWT_SECRET seguro (Linux/Mac)
openssl rand -base64 64

# Generar JWT_SECRET seguro (PowerShell)
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

# Generar contraseña de BD segura
openssl rand -base64 32
```

---

## 5. Comparativa Antes/Después

| Aspecto | ❌ Antes | ✅ Después |
|---------|---------|-----------|
| Secreto en código | `"change-this-secret..."` | No existe |
| Validación | Solo en producción | Todos los ambientes |
| Password BD vacío | Permitido | Prohibido |
| Tipado de `secret` | `string \| undefined` | `string` |
| Mensaje de error | Genérico | Descriptivo y accionable |
| Arranque sin .env | ✅ Funciona (inseguro) | ❌ Falla inmediatamente |

---

## 6. Impacto en el Desarrollo

### 6.1 Nuevo Flujo de Onboarding

1. Clonar repositorio
2. **Copiar `.env.example` a `.env`** ← Nuevo paso obligatorio
3. Generar secretos seguros
4. `npm install`
5. `npm run dev`

### 6.2 CI/CD

Los pipelines deben configurar variables de entorno:

```yaml
# GitHub Actions ejemplo
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  DB_USERS_PASSWORD: ${{ secrets.DB_USERS_PASSWORD }}
  DB_CASES_PASSWORD: ${{ secrets.DB_CASES_PASSWORD }}
  DB_LOGS_PASSWORD: ${{ secrets.DB_LOGS_PASSWORD }}
```

---

## 7. Referencias

- [CWE-547: Use of Hard-coded, Security-relevant Constants](https://cwe.mitre.org/data/definitions/547.html)
- [OWASP: Credential Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Management_Cheat_Sheet.html)
- [12-Factor App: Config](https://12factor.net/config)

---

## 8. Historial de Cambios

| Fecha | Versión | Descripción |
|-------|---------|-------------|
| 2026-01-10 | 1.0 | Implementación de Fail Fast para secretos críticos |
| 2026-01-10 | 1.1 | Agregado PSEUDONIMO_HMAC_SECRET a configuración centralizada |
