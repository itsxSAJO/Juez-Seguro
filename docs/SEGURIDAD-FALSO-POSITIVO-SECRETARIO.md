# Falso Positivo: "Hardcoded Secret" en Rol SECRETARIO

**Fecha:** 10 de enero de 2026  
**Severidad Reportada:** 768 (Alta)  
**Herramienta de Detección:** Snyk  
**CWE Reportado:** CWE-547 (Hardcoded Non-Cryptographic Secret)  
**Estado:** ⚠️ FALSO POSITIVO - DOCUMENTADO  

---

## 1. Ubicación del Hallazgo

- **Archivo:** `frontend/src/lib/funcionarios-data.ts`
- **Líneas:** 216-220

```typescript
const rolNombreToCargoMap: Record<string, "cj" | "juez" | "secretario"> = {
  ADMIN_CJ: "cj",
  JUEZ: "juez",
  SECRETARIO: "secretario",  // ← Snyk marca esta línea
};
```

---

## 2. Análisis Técnico del Falso Positivo

### 2.1 Por qué Snyk lo detecta

Las herramientas SAST utilizan análisis de patrones (pattern matching) para detectar secretos hardcodeados. Snyk identifica la subcadena `SECRET` dentro de:

- **Variable:** `SECRETARIO` (contiene `SECRET` + `ARIO`)
- **Valor:** `"secretario"` (contiene `secret` + `ario`)

El algoritmo de detección no tiene contexto semántico para distinguir entre:
- `SECRET_KEY = "abc123"` → ✅ Secreto real (debería alertar)
- `SECRETARIO = "secretario"` → ❌ Rol de funcionario (falso positivo)

### 2.2 Contexto del Dominio

En el contexto del Sistema Judicial Ecuatoriano, **"Secretario"** es un cargo público oficial:

| Término | Significado en el Sistema |
|---------|---------------------------|
| `SECRETARIO` | Cargo: Secretario de Juzgado (Court Clerk) |
| `"secretario"` | Identificador de rol para control de acceso |

Este valor es:
- ✅ **Público:** Es un cargo visible en cualquier organigrama judicial
- ✅ **No sensible:** No otorga acceso por sí mismo (requiere autenticación)
- ✅ **Lógica de negocio:** Usado para mapear roles entre backend y frontend
- ❌ **NO es un secreto criptográfico**
- ❌ **NO es una contraseña**
- ❌ **NO es un token de acceso**
- ❌ **NO es una API key**

---

## 3. Justificación Formal para Exclusión

### Para archivo `.snyk` o reporte de auditoría:

```
EXCLUSIÓN DE FALSO POSITIVO - CWE-547

Archivo: frontend/src/lib/funcionarios-data.ts
Línea: 219
Código: SECRETARIO: "secretario"

JUSTIFICACIÓN:
La cadena "SECRETARIO" y su valor "secretario" corresponden al cargo de 
Secretario de Juzgado (Court Clerk) en el Sistema Judicial Ecuatoriano.
Este es un identificador de rol para lógica de negocio (control de acceso 
basado en roles - RBAC), NO un secreto criptográfico.

El valor es:
1. Público: Cargo visible en organigramas oficiales
2. No sensible: No otorga privilegios sin autenticación previa
3. Inmutable: Definido por la estructura organizacional

La herramienta Snyk detecta el patrón "SECRET" dentro de "SECRETARIO" 
mediante análisis léxico sin contexto semántico, generando un falso positivo.

No se requiere remediación. Se documenta para trazabilidad de auditoría.

Fecha de análisis: 2026-01-10
Analizado por: Equipo de Desarrollo Seguro
```

---

## 4. Configuración de Exclusión en Snyk

### Opción A: Archivo `.snyk` en la raíz del proyecto

```yaml
# .snyk - Política de exclusiones de seguridad
version: v1.25.0
ignore:
  SNYK-JS-HARDCODEDSECRET-0000000:  # Reemplazar con ID real del issue
    - 'frontend/src/lib/funcionarios-data.ts':
        reason: >
          Falso positivo: "SECRETARIO" es el cargo de Secretario de Juzgado 
          (Court Clerk), un rol público del sistema judicial ecuatoriano. 
          No es un secreto criptográfico.
        expires: 2027-01-10  # Revisar anualmente
```

### Opción B: Comentario inline (si Snyk lo soporta)

```typescript
// snyk-ignore: SECRETARIO es un cargo judicial, no un secreto
SECRETARIO: "secretario",
```

---

## 5. Evidencia de No-Sensibilidad

### 5.1 El valor es usado solo para mapeo de UI

```typescript
// Uso en el código - solo afecta la visualización
cargo: rolNombreToCargoMap[u.rolNombre] || u.cargo || "secretario",
```

### 5.2 La autenticación real está en otro lugar

Los secretos REALES del sistema están en:
- `JWT_SECRET` → Variables de entorno (mitigado en issue anterior)
- `DB_*_PASSWORD` → Variables de entorno (mitigado en issue anterior)

### 5.3 El rol "secretario" no tiene valor como secreto

Si un atacante conoce que existe el rol `"secretario"`:
- ❌ No puede autenticarse (requiere credenciales)
- ❌ No puede escalar privilegios (validado en backend)
- ❌ No puede explotar ninguna vulnerabilidad

---

## 6. Decisión Final

| Aspecto | Decisión |
|---------|----------|
| ¿Es un secreto real? | **NO** |
| ¿Requiere remediación? | **NO** |
| ¿Debe documentarse? | **SÍ** (este documento) |
| ¿Debe excluirse en Snyk? | **SÍ** (con justificación) |
| ¿Modificar el código? | **NO** (funcional y correcto) |

---

## 7. Referencias

- [CWE-547: Use of Hard-coded, Security-relevant Constants](https://cwe.mitre.org/data/definitions/547.html)
- [Snyk: Ignoring Issues](https://docs.snyk.io/scan-using-snyk/policies/the-.snyk-file)
- [OWASP: False Positives in SAST](https://owasp.org/www-community/controls/Static_Code_Analysis)

---

## 8. Historial

| Fecha | Acción |
|-------|--------|
| 2026-01-10 | Análisis inicial y documentación de falso positivo |
