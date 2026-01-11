# Falso Positivo: "Hardcoded Secret" en AUTH_TOKEN_KEY

**Fecha:** 10 de enero de 2026  
**Severidad Reportada:** 768 (Alta)  
**Herramienta de Detección:** Snyk  
**CWE Reportado:** CWE-547 (Hardcoded Non-Cryptographic Secret)  
**Estado:** ⚠️ FALSO POSITIVO - DOCUMENTADO  

---

## 1. Ubicación del Hallazgo

- **Archivo:** `frontend/src/services/auth.service.ts`
- **Líneas:** 9-10

```typescript
const AUTH_TOKEN_KEY = "authToken";
const USER_DATA_KEY = "userData";
```

---

## 2. Análisis Técnico del Falso Positivo

### 2.1 Por qué Snyk lo detecta

Snyk utiliza análisis de patrones para detectar secretos. La variable `AUTH_TOKEN_KEY` contiene:
- `TOKEN` → Patrón asociado a tokens de acceso
- `KEY` → Patrón asociado a claves criptográficas

El algoritmo interpreta `TOKEN` + `KEY` como indicador de secreto hardcodeado.

### 2.2 Qué es realmente este código

```typescript
// Esto NO es un secreto:
const AUTH_TOKEN_KEY = "authToken";

// Es el NOMBRE de la clave para localStorage:
localStorage.setItem(AUTH_TOKEN_KEY, response.data.token);
//                   ↑ Nombre de clave    ↑ El valor real (JWT del servidor)
```

**Analogía:** Es como decir que `const COLUMN_NAME = "password"` es un secreto. No lo es - es el nombre de una columna, no el valor.

### 2.3 Clasificación del valor

| Aspecto | `AUTH_TOKEN_KEY` | Secreto Real |
|---------|------------------|--------------|
| Contiene | `"authToken"` (nombre de clave) | Valor del JWT |
| Sensibilidad | Pública (visible en DevTools) | Privada |
| Impacto si se filtra | Ninguno | Suplantación de identidad |
| Dónde está el secreto real | En `localStorage.authToken` | En el JWT del servidor |

---

## 3. Justificación Formal para Exclusión

### Para archivo `.snyk` o reporte de auditoría:

```
EXCLUSIÓN DE FALSO POSITIVO - CWE-547

Archivo: frontend/src/services/auth.service.ts
Líneas: 9-10
Código: 
  const AUTH_TOKEN_KEY = "authToken";
  const USER_DATA_KEY = "userData";

JUSTIFICACIÓN:
Estas constantes definen los NOMBRES de las claves utilizadas para 
almacenar datos en localStorage del navegador. NO contienen secretos,
tokens, ni valores sensibles.

- AUTH_TOKEN_KEY = "authToken" → Nombre de la clave donde SE GUARDARÁ el JWT
- USER_DATA_KEY = "userData" → Nombre de la clave donde SE GUARDARÁN datos de usuario

El valor sensible real (el JWT) proviene del servidor en tiempo de ejecución
y se almacena usando estas claves como identificadores.

Snyk detecta el patrón "TOKEN" + "KEY" en el nombre de la variable,
interpretándolo erróneamente como un secreto criptográfico.

Los nombres de claves de localStorage son:
1. Públicos: Visibles en DevTools del navegador
2. No sensibles: Conocerlos no otorga acceso
3. Estándar: Es práctica común nombrar claves así

No se requiere remediación. Se documenta para trazabilidad.

Fecha de análisis: 2026-01-10
Analizado por: Equipo de Desarrollo Seguro
```

---

## 4. Configuración de Exclusión en Snyk

### Archivo `.snyk`

```yaml
version: v1.25.0
ignore:
  SNYK-JS-HARDCODEDSECRET-0000000:  # Reemplazar con ID real
    - 'frontend/src/services/auth.service.ts':
        reason: >
          Falso positivo: AUTH_TOKEN_KEY y USER_DATA_KEY son nombres de 
          claves para localStorage, no secretos criptográficos. Los valores 
          sensibles (JWT) provienen del servidor en runtime.
        expires: 2027-01-10
```

---

## 5. Evidencia de No-Sensibilidad

### 5.1 El código usa la constante como NOMBRE, no como VALOR

```typescript
// La constante es el nombre de la clave
localStorage.setItem(AUTH_TOKEN_KEY, response.data.token);
//                   ↑ "authToken"    ↑ El JWT real del servidor

// Equivalente a escribir:
localStorage.setItem("authToken", response.data.token);
```

### 5.2 Los nombres de localStorage son públicos por diseño

Cualquier usuario puede ver las claves de localStorage en:
```
DevTools → Application → Local Storage
```

Esto es comportamiento esperado y documentado del navegador.

### 5.3 El secreto real está protegido

| Componente | Ubicación | Protección |
|------------|-----------|------------|
| JWT Secret (firma) | Backend `.env` | ✅ Variable de entorno |
| JWT Token (valor) | Runtime del servidor | ✅ Generado dinámicamente |
| Nombre de clave | Código fuente | Público (no sensible) |

---

## 6. Por qué NO se refactoriza

Consideramos renombrar la constante para evitar el patrón detectado:

```typescript
// Alternativa considerada:
const STORAGE_AUTH_ID = "authToken";  // Evita "TOKEN_KEY"
```

**Decisión: NO refactorizar**

Razones:
1. **Claridad > Silenciar warnings:** `AUTH_TOKEN_KEY` es autodescriptivo
2. **No resuelve el problema:** El valor `"authToken"` sigue conteniendo "token"
3. **Código correcto:** No hay vulnerabilidad real que corregir
4. **Documentación suficiente:** La exclusión justificada es la solución apropiada

---

## 7. Decisión Final

| Aspecto | Decisión |
|---------|----------|
| ¿Es un secreto real? | **NO** |
| ¿Requiere remediación? | **NO** |
| ¿Debe documentarse? | **SÍ** (este documento) |
| ¿Debe excluirse en Snyk? | **SÍ** (con justificación) |
| ¿Modificar el código? | **NO** (claro y correcto) |

---

## 8. Referencias

- [MDN: Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [OWASP: HTML5 Security - Local Storage](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#local-storage)
- [Snyk: Ignoring Issues](https://docs.snyk.io/scan-using-snyk/policies/the-.snyk-file)

---

## 9. Historial

| Fecha | Acción |
|-------|--------|
| 2026-01-10 | Análisis inicial y documentación de falso positivo |
