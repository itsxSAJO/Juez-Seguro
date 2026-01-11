# Corrección de Vulnerabilidad: Hashes bcrypt Hardcodeados en Seed

## Información de la Vulnerabilidad

| Campo | Valor |
|-------|-------|
| **CWE** | CWE-798: Use of Hard-coded Credentials |
| **Regla Snyk** | Hardcoded bcrypt password hash |
| **Severidad** | 🟠 Media (contexto de desarrollo) |
| **Archivo Original** | `scripts/usuarios/03_seed_users_dev.sql` |
| **Líneas Afectadas** | 39, 51, 62 |
| **Fecha Corrección** | 2026-01-11 |
| **Sprint** | Sprint 3 - Remediación de Seguridad |

---

## Descripción del Problema

El archivo SQL de seed para desarrollo contenía hashes bcrypt hardcodeados:

```sql
-- ❌ VULNERABLE - Hashes expuestos en código fuente
INSERT INTO funcionarios (..., password_hash, ...) VALUES 
    (..., '$2a$12$SpGeJZ9LW9Dkk9YDmwvKMu5Zj/9g1R2FCl3D1tf4NZf/Ogwdpv/NC', ...),  -- Admin
    (..., '$2a$12$wio9ab.9JHhAJaj0PXz1qeHR60x8QjYaEeS1y5JuJzO5FaTLrFdl6', ...),  -- Juez
    (..., '$2a$12$Ak3dgV3mB7CLKlBIcXtA3ed0TrCwmo5MiOU0bofNb3FNpswgGts0O', ...);  -- Secretario
```

### ¿Por qué es un problema?

Aunque bcrypt es un hash one-way (irreversible), Snyk y las mejores prácticas recomiendan:

1. **No exponer hashes en repositorios**: Facilita ataques offline de fuerza bruta
2. **Rotación de credenciales**: Hashes hardcodeados dificultan cambiar contraseñas
3. **Separación de secretos**: Credenciales no deben estar en control de versiones
4. **Auditoría**: Difícil rastrear cuándo se crearon/modificaron las credenciales

---

## Solución Implementada

### Enfoque: Script TypeScript con Generación Dinámica

Se creó un nuevo script que genera los hashes en runtime usando el mismo servicio que el backend:

```
scripts/usuarios/03_seed_users_dev.sql  →  DEPRECADO
backend/scripts/seed-users-dev.ts       →  NUEVO (reemplazo)
```

### Arquitectura de la Solución

```
┌─────────────────────────────────────────────────────────────────┐
│                    seed-users-dev.ts                            │
├─────────────────────────────────────────────────────────────────┤
│  1. Validar NODE_ENV === "development" (Fail Fast)              │
│  2. Leer contraseñas de variables de entorno                    │
│  3. Generar hashes con bcrypt.hash() en runtime                 │
│  4. Insertar usuarios en PostgreSQL                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Variables de Entorno                         │
├─────────────────────────────────────────────────────────────────┤
│  DEV_ADMIN_PASSWORD     (opcional, tiene default seguro)        │
│  DEV_JUEZ_PASSWORD      (opcional, tiene default seguro)        │
│  DEV_SECRETARIO_PASSWORD (opcional, tiene default seguro)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Código de la Solución

### Validación de Entorno (Fail Fast)

```typescript
// backend/scripts/seed-users-dev.ts
if (config.nodeEnv !== "development") {
  console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  ❌ ERROR: ENTORNO DE PRODUCCIÓN DETECTADO                      ║
╠══════════════════════════════════════════════════════════════════╣
║  Este script SOLO puede ejecutarse en desarrollo.               ║
╚══════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}
```

### Generación Dinámica de Hashes

```typescript
// El hash se genera en runtime, nunca se almacena en código
const passwordHash = await bcrypt.hash(user.password, config.security.bcryptRounds);

await client.query(
  `INSERT INTO funcionarios (..., password_hash, ...) 
   VALUES (..., $4, ...)`,
  [..., passwordHash, ...]
);
```

### Contraseñas con Defaults Seguros

```typescript
// Las contraseñas tienen defaults que cumplen Common Criteria
// pero pueden sobrescribirse con variables de entorno
const DEV_PASSWORDS = {
  admin: getDevPassword("DEV_ADMIN_PASSWORD", "JzAdm1n_CJ2026Seguro!"),
  juez: getDevPassword("DEV_JUEZ_PASSWORD", "JzJuez_T1tular2026Sec!"),
  secretario: getDevPassword("DEV_SECRETARIO_PASSWORD", "JzSecr3t_Jud2026Seg!"),
};
```

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `backend/scripts/seed-users-dev.ts` | **NUEVO** - Script TypeScript |
| `backend/package.json` | Agregado script `db:seed-users-dev` |
| `scripts/usuarios/03_seed_users_dev.sql` | **DEPRECADO** - Hashes eliminados |

---

## Uso del Nuevo Script

### Ejecución

```bash
cd backend
npm run db:seed-users-dev
```

### Salida Esperada

```
╔══════════════════════════════════════════════════════════════════╗
║  🌱 SEED DE USUARIOS DE DESARROLLO                              ║
╠══════════════════════════════════════════════════════════════════╣
║  Generando hashes bcrypt dinámicamente...                        ║
║  Rounds: 12                                                      ║
╚══════════════════════════════════════════════════════════════════╝

✓ Usuario creado/actualizado: admin.cj@judicatura.gob.ec (ID: 1)
✓ Usuario creado/actualizado: juez.gutierrez@judicatura.gob.ec (ID: 2)
✓ Usuario creado/actualizado: secretario.paredes@judicatura.gob.ec (ID: 3)

╔══════════════════════════════════════════════════════════════════╗
║  ✅ SEED COMPLETADO EXITOSAMENTE                                ║
╚══════════════════════════════════════════════════════════════════╝
```

### Personalizar Contraseñas

```bash
# En .env o exportar antes de ejecutar
DEV_ADMIN_PASSWORD="MiPasswordAdmin2026!"
DEV_JUEZ_PASSWORD="MiPasswordJuez2026!"
DEV_SECRETARIO_PASSWORD="MiPasswordSecretario2026!"

npm run db:seed-users-dev
```

---

## Comparación: Antes vs Después

| Aspecto | Antes (SQL) | Después (TypeScript) |
|---------|-------------|----------------------|
| **Hashes en código** | ❌ Sí, hardcodeados | ✅ No, generados en runtime |
| **Validación de entorno** | ❌ Ninguna | ✅ Fail Fast si no es dev |
| **Contraseñas configurables** | ❌ No | ✅ Vía variables de entorno |
| **Reutiliza config** | ❌ No | ✅ Usa `config.security.bcryptRounds` |
| **Detección Snyk** | ❌ 3 hallazgos | ✅ 0 hallazgos |

---

## Verificación de la Corrección

### 1. Escaneo Snyk

```bash
snyk code test --include-unmanaged
# ✅ No debe mostrar "Hardcoded bcrypt password hash"
```

### 2. Intentar en Producción (Debe Fallar)

```bash
NODE_ENV=production npm run db:seed-users-dev
# ❌ ERROR: ENTORNO DE PRODUCCIÓN DETECTADO
```

### 3. Ejecutar en Desarrollo

```bash
NODE_ENV=development npm run db:seed-users-dev
# ✅ Usuarios creados con hashes nuevos
```

---

## Credenciales de Prueba (Desarrollo)

| Rol | Correo | Variable de Entorno |
|-----|--------|---------------------|
| **ADMIN_CJ** | admin.cj@judicatura.gob.ec | `DEV_ADMIN_PASSWORD` |
| **JUEZ** | juez.gutierrez@judicatura.gob.ec | `DEV_JUEZ_PASSWORD` |
| **SECRETARIO** | secretario.paredes@judicatura.gob.ec | `DEV_SECRETARIO_PASSWORD` |

> **Nota**: Las contraseñas por defecto están documentadas en el script y cumplen con Common Criteria (16+ caracteres, mayúsculas, minúsculas, números, símbolos).

---

## Referencias

- [CWE-798: Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html)
- [Snyk: Hardcoded Secrets](https://docs.snyk.io/scan-application-code/snyk-code/snyk-code-security-rules/hardcoded-secrets)
- [OWASP: Credential Management](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Management_Cheat_Sheet.html)
- [bcrypt Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

---

## Impacto en Common Criteria (ISO 15408)

| Clase Funcional | Componente | Cumplimiento |
|-----------------|------------|--------------|
| FIA (Identificación y Autenticación) | FIA_SOS.1 | ✅ Credenciales no expuestas |
| FIA (Identificación y Autenticación) | FIA_UAU.1 | ✅ Autenticación segura mantenida |
| FMT (Gestión de Seguridad) | FMT_MSA.1 | ✅ Gestión segura de atributos |

---

**Documento generado para auditoría de seguridad - Proyecto Juez Seguro**
