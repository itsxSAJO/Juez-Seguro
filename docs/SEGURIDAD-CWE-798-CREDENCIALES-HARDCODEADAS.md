# Corrección de Vulnerabilidad: Credenciales Hardcodeadas (CWE-798)

## Información de la Vulnerabilidad

| Campo | Valor |
|-------|-------|
| **CWE** | CWE-798: Use of Hard-coded Credentials |
| **Regla SonarQube** | S6437 - Credentials should not be hardcoded |
| **Severidad** | 🔴 Crítica |
| **CVSS Estimado** | 9.8 (Critical) |
| **Archivo Afectado** | `backend/src/services/firma.service.ts` |
| **Línea Original** | 21 |
| **Fecha Corrección** | 2026-01-11 |
| **Sprint** | Sprint 3 - Firma Digital |

---

## Descripción del Problema

El servicio de firma digital contenía una contraseña hardcodeada para acceder a los almacenes de claves PKI (archivos `.pfx/.p12`):

```typescript
// ❌ VULNERABLE - Código original (línea 21)
const PFX_PASSWORD = process.env.PFX_PASSWORD || "Seguridad2026";
```

### ¿Por qué es crítico?

1. **Exposición en Control de Versiones**: El password queda visible en el historial de Git
2. **Compromiso de PKI**: Si un atacante obtiene el código fuente, puede:
   - Firmar documentos judiciales fraudulentos
   - Suplantar la identidad de cualquier juez
   - Invalidar el principio de **No Repudio**
3. **Incumplimiento Normativo**: Viola estándares como:
   - ISO 27001 (Control A.9.4.3)
   - OWASP Top 10 2021 (A07:2021)
   - PCI-DSS Requirement 8.2.1

---

## Solución Implementada

### Patrón: Fail Fast con Variables de Entorno Obligatorias

Se centralizó la configuración PKI en `config/index.ts` usando el patrón **Fail Fast**:

```typescript
// ✅ SEGURO - config/index.ts
const PFX_PASSWORD = getRequiredEnv(
  "PFX_PASSWORD", 
  "Contraseña del almacén de claves PKI (.pfx/.p12)"
);

export const config = {
  // ...
  pki: {
    basePath: getOptionalEnv("PKI_JUECES_CERTS_PATH", "./certs/jueces"),
    caCertPath: getOptionalEnv("PKI_CA_CERT_PATH", "./certs/ca/ca.crt"),
    pfxPassword: PFX_PASSWORD,  // Sin fallback - validado arriba
  },
};
```

### Refactorización del Servicio de Firma

```typescript
// ✅ SEGURO - firma.service.ts
import { config } from "../config/index.js";

const PKI_BASE_PATH = config.pki.basePath;
const CA_CERT_PATH = config.pki.caCertPath;
const PFX_PASSWORD = config.pki.pfxPassword;  // OBLIGATORIO - Sin fallback
```

---

## Comportamiento Fail Fast

Si `PFX_PASSWORD` no está configurada, el servidor **NO arranca**:

```
╔══════════════════════════════════════════════════════════════════╗
║  ❌ ERROR FATAL DE CONFIGURACIÓN                                 ║
╠══════════════════════════════════════════════════════════════════╣
║  Variable: PFX_PASSWORD                                          ║
║   (Contraseña del almacén de claves PKI (.pfx/.p12))             ║
╠══════════════════════════════════════════════════════════════════╣
║  La aplicación NO puede iniciar sin esta configuración.          ║
║  Por favor, configúrala en el archivo .env                       ║
╚══════════════════════════════════════════════════════════════════╝
```

**Beneficios del Fail Fast:**
- Detecta configuración faltante en tiempo de despliegue (no en runtime)
- Mensaje de error claro indica exactamente qué falta
- Previene ejecución insegura del sistema

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `backend/src/config/index.ts` | Agregada sección `pki` con `getRequiredEnv()` |
| `backend/src/services/firma.service.ts` | Refactorizado para usar `config.pki.*` |
| `backend/.env` | Agregada variable `PFX_PASSWORD` |
| `backend/.env.example` | Documentada sección PKI obligatoria |

---

## Configuración Requerida

### Archivo `.env` (Desarrollo)
```dotenv
# PKI - Firma Digital (Certificados X.509)
PFX_PASSWORD=tu-password-seguro-aqui
```

### Archivo `.env.example` (Plantilla)
```dotenv
# PKI - Firma Digital (Sprint 3 - Certificados X.509)
# OBLIGATORIO: Contraseña para archivos .pfx/.p12 de jueces
PFX_PASSWORD=your-pfx-password-change-in-production
# Rutas opcionales (tienen defaults seguros)
# PKI_JUECES_CERTS_PATH=./certs/jueces
# PKI_CA_CERT_PATH=./certs/ca/ca.crt
```

---

## Diferenciación de Variables

| Variable | Tipo | Justificación |
|----------|------|---------------|
| `PFX_PASSWORD` | **Obligatoria** | Credencial crítica - compromete firma digital |
| `PKI_JUECES_CERTS_PATH` | Opcional | Ruta relativa, no es secreto |
| `PKI_CA_CERT_PATH` | Opcional | Ruta relativa, no es secreto |

---

## Verificación de la Corrección

### 1. Sin Variable (Debe Fallar)
```bash
# Eliminar PFX_PASSWORD del .env
npm run dev
# ❌ Error: Variable PFX_PASSWORD no configurada
```

### 2. Con Variable (Debe Funcionar)
```bash
# Agregar PFX_PASSWORD al .env
npm run dev
# ✅ Servidor inicia correctamente
```

### 3. SonarQube/Snyk
```bash
# Re-escanear código
sonar-scanner
# ✅ S6437 ya no debe aparecer en firma.service.ts
```

---

## Referencias

- [CWE-798: Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html)
- [SonarQube S6437](https://rules.sonarsource.com/typescript/RSPEC-6437/)
- [OWASP: Credential Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Management_Cheat_Sheet.html)
- [12-Factor App: Config](https://12factor.net/config)

---

## Impacto en Common Criteria (ISO 15408)

| Clase Funcional | Componente | Cumplimiento |
|-----------------|------------|--------------|
| FIA (Identificación y Autenticación) | FIA_SOS.1 | ✅ Secretos no expuestos en código |
| FDP (Protección de Datos) | FDP_ACC.1 | ✅ Control de acceso a claves PKI |
| FCS (Soporte Criptográfico) | FCS_COP.1 | ✅ Protección de claves de firma |

---

**Documento generado para auditoría de seguridad - Proyecto Juez Seguro**
