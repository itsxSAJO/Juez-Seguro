# Mitigación de Validación Impropia de Tipos (CWE-1287)

## Información del Issue

| Campo | Valor |
|-------|-------|
| **CWE** | CWE-1287: Improper Validation of Specified Type of Input |
| **Score Snyk** | Reportado en análisis |
| **Archivo Afectado** | `backend/src/middleware/validateCausa.ts` |
| **Funciones** | `validateCausaFormatMiddleware`, `validatePartialSearchMiddleware` |
| **Fecha de Mitigación** | 2026-01-10 |
| **Estado** | ✅ Mitigado |

---

## Código Vulnerable (Antes)

### `validatePartialSearchMiddleware`

```typescript
export const validatePartialSearchMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // ⚠️ El casting "as string" desaparece en runtime
  const query = req.query.q as string || req.query.busqueda as string;
  
  if (!query) {
    // ...
  }
  
  // ⚠️ Si query es un array u objeto, .trim() causa CRASH
  if (query.trim().length < 5) {
    // ...
  }
  
  next();
};
```

### `validateCausaFormatMiddleware`

```typescript
const numeroCausa = 
  req.query.numeroProceso as string ||  // ⚠️ Casting peligroso
  req.params.numeroProceso ||
  req.body?.numeroProceso;
```

---

## El Problema: HTTP Parameter Pollution (HPP)

### ¿Qué es HPP?

Express.js parsea los query parameters de forma especial:

| Request | `req.query.q` | Tipo Real |
|---------|---------------|-----------|
| `?q=test` | `"test"` | `string` |
| `?q[0]=a&q[1]=b` | `["a", "b"]` | `array` |
| `?q[key]=val` | `{ key: "val" }` | `object` |

### ¿Por qué falla el código?

```typescript
const query = req.query.q as string;  // TypeScript cree que es string
query.trim();  // ⚠️ CRASH si query es ["a", "b"] o { key: "val" }
```

El operador `as string` de TypeScript es solo una **anotación de tipo** que **desaparece completamente** al compilar a JavaScript. No realiza ninguna validación en runtime.

### Escenario de Ataque

```bash
# Ataque: Enviar array en lugar de string
curl "http://localhost:3000/api/publico/causas/buscar?q[0]=test"

# Resultado ANTES: TypeError: query.trim is not a function
# El servidor crashea (DoS)
```

---

## Código Mitigado (Después)

### Función de Extracción Segura

```typescript
/**
 * SEGURIDAD: Extrae un query parameter como string de forma segura.
 * Previene ataques de HTTP Parameter Pollution (HPP) donde el atacante
 * envía arrays u objetos en lugar de strings (ej: ?q[0]=val o ?q[key]=val).
 * 
 * CWE-1287: Improper Validation of Specified Type of Input
 * 
 * @param value - Valor del query parameter (puede ser string, array u objeto)
 * @returns string si es válido, undefined si no es un string primitivo
 */
function getSafeQueryString(value: unknown): string | undefined {
  // Si es undefined o null, retornar undefined
  if (value === undefined || value === null) {
    return undefined;
  }
  
  // SEGURIDAD: Solo aceptar strings primitivos
  if (typeof value !== 'string') {
    return undefined;
  }
  
  return value;
}
```

### `validatePartialSearchMiddleware` Corregido

```typescript
export const validatePartialSearchMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // SEGURIDAD: Extraer query params de forma segura (previene CWE-1287 y HPP)
  const query = getSafeQueryString(req.query.q) || getSafeQueryString(req.query.busqueda);
  
  if (!query) {
    res.status(400).json({
      success: false,
      error: "Término de búsqueda requerido. Debe ser un texto válido.",
      code: "MISSING_SEARCH_TERM",
    });
    return;
  }
  
  // SEGURIDAD: Ahora es seguro usar .trim() porque validamos el tipo en runtime
  const trimmedQuery = query.trim();
  
  if (trimmedQuery.length < 5) {
    res.status(400).json({
      success: false,
      error: "El término de búsqueda debe tener al menos 5 caracteres",
      code: "SEARCH_TOO_SHORT",
      minLength: 5,
    });
    return;
  }
  
  next();
};
```

### `validateCausaFormatMiddleware` Corregido

```typescript
const numeroCausa = 
  getSafeQueryString(req.query.numeroProceso) ||
  req.params.numeroProceso ||
  (typeof req.body?.numeroProceso === 'string' ? req.body.numeroProceso : undefined);
```

---

## Tabla de Protección

| Escenario | Request | Antes | Después |
|-----------|---------|-------|---------|
| Normal | `?q=17332` | ✅ Funciona | ✅ Funciona |
| HPP (array) | `?q[0]=x` | ❌ **Crash** | ✅ Error 400 |
| HPP (objeto) | `?q[key]=x` | ❌ **Crash** | ✅ Error 400 |
| Sin parámetro | `?` | ❌ **Crash** | ✅ Error 400 |
| String vacío | `?q=` | ⚠️ Error 400 | ✅ Error 400 |

---

## Principios de Seguridad Aplicados

### 1. Validación en Runtime (No confiar en TypeScript)

TypeScript solo valida en **compile-time**. Los ataques ocurren en **runtime**.

```typescript
// ❌ MAL: TypeScript no protege en runtime
const query = req.query.q as string;

// ✅ BIEN: Validación explícita en runtime
if (typeof value !== 'string') {
  return undefined;
}
```

### 2. Fail Safe

Si el tipo no es el esperado, retornamos `undefined` y respondemos con error 400, en lugar de crashear.

### 3. Defense in Depth

Validamos el tipo en múltiples niveles:
1. `getSafeQueryString()` - Extracción segura
2. Verificación de existencia (`if (!query)`)
3. Validación de longitud (después de `trim()`)

---

## Cómo Probar la Mitigación

```bash
# Caso normal (debe funcionar)
curl "http://localhost:3000/api/publico/causas/buscar?q=17332-2024"

# Ataque HPP con array (debe retornar 400, NO crashear)
curl "http://localhost:3000/api/publico/causas/buscar?q[0]=test&q[1]=attack"

# Ataque HPP con objeto (debe retornar 400, NO crashear)
curl "http://localhost:3000/api/publico/causas/buscar?q[key]=malicious"
```

### Respuesta Esperada para Ataques:

```json
{
  "success": false,
  "error": "Término de búsqueda requerido. Debe ser un texto válido.",
  "code": "MISSING_SEARCH_TERM"
}
```

---

## Referencias

- [CWE-1287: Improper Validation of Specified Type of Input](https://cwe.mitre.org/data/definitions/1287.html)
- [OWASP: HTTP Parameter Pollution](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/04-Testing_for_HTTP_Parameter_Pollution)
- [Express.js Query Parsing](https://expressjs.com/en/api.html#req.query)
- [TypeScript Type Assertions vs Runtime Checks](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)
