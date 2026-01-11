# Corrección de Seguridad: Improper Type Validation en usuarios.routes.ts (CWE-1287)

## Información de la Vulnerabilidad

| Campo | Valor |
|-------|-------|
| **CWE** | CWE-1287: Improper Validation of Specified Type of Input |
| **Severidad** | Media |
| **Archivo Afectado** | `backend/src/routes/usuarios.routes.ts` |
| **Ruta** | `GET /api/usuarios/verificar-disponibilidad` |
| **Líneas** | 51-61 |
| **Herramienta de Detección** | Snyk Code |
| **Fecha de Corrección** | 2026-01-10 |

## Descripción del Problema

El código utilizaba un **type assertion** de TypeScript (`as string`) que no proporciona validación en tiempo de ejecución:

```typescript
const correo = req.query.correo as string;  // ❌ No valida en runtime

// Más adelante...
correo.toLowerCase();  // ❌ Crash si correo no es string
```

### Por qué `as string` es peligroso

| Característica | `as string` (Type Assertion) |
|----------------|------------------------------|
| Validación compile-time | ✅ Sí (TypeScript confía) |
| Validación runtime | ❌ No (se elimina en transpilación) |
| Previene crashes | ❌ No |
| Existe en JavaScript | ❌ No (solo TypeScript) |

### Tipo real de `req.query.*`

Según Express, los parámetros de query tienen este tipo:

```typescript
type QueryParamValue = string | string[] | ParsedQs | ParsedQs[] | undefined;
```

## Vectores de Ataque

### HTTP Parameter Pollution (HPP)

```bash
# Parámetro duplicado → Express lo convierte en array
GET /api/usuarios/verificar-disponibilidad?correo=a@test.com&correo=b@test.com

# req.query.correo = ["a@test.com", "b@test.com"]
# ["a@test.com", "b@test.com"].toLowerCase() → TypeError: toLowerCase is not a function
```

### Notación de objeto

```bash
# Algunos parsers interpretan esto como objeto
GET /api/usuarios/verificar-disponibilidad?correo[key]=value

# req.query.correo = { key: "value" }
# { key: "value" }.toLowerCase() → TypeError
```

### Impacto

| Escenario | Resultado |
|-----------|-----------|
| `correo` es string | ✅ Funciona normalmente |
| `correo` es array | ❌ `TypeError: toLowerCase is not a function` |
| `correo` es objeto | ❌ `TypeError: toLowerCase is not a function` |
| `correo` es undefined | ❌ `TypeError: Cannot read property 'toLowerCase' of undefined` |

## Código Vulnerable

```typescript
router.get(
  "/verificar-disponibilidad",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correo = req.query.correo as string;  // ❌ Type assertion inseguro
      
      if (!correo) {  // Solo verifica falsy, no el tipo
        res.status(400).json({
          success: false,
          error: "Correo requerido",
        });
        return;
      }

      // ❌ Si correo es array/objeto, crash aquí
      const disponible = await funcionariosService.verificarDisponibilidadCorreo(
        correo.toLowerCase()
      );
```

## Solución Implementada

```typescript
router.get(
  "/verificar-disponibilidad",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correoParam = req.query.correo;

      // SEGURIDAD: Validación de tipo en runtime (CWE-1287)
      // req.query.* puede ser string | string[] | undefined
      // El cast 'as string' NO valida en runtime y puede causar crash
      if (typeof correoParam !== 'string') {
        res.status(400).json({
          success: false,
          error: "Parámetro 'correo' debe ser un string válido",
          code: "TIPO_INVALIDO",
        });
        return;
      }

      if (!correoParam.trim()) {
        res.status(400).json({
          success: false,
          error: "Correo requerido",
        });
        return;
      }

      const disponible = await funcionariosService.verificarDisponibilidadCorreo(
        correoParam.toLowerCase()
      );
```

## Cambios Realizados

| Aspecto | Antes | Después |
|---------|-------|---------|
| Obtención del parámetro | `req.query.correo as string` | `req.query.correo` (sin cast) |
| Validación de tipo | ❌ Ninguna | ✅ `typeof !== 'string'` |
| Respuesta a tipo inválido | ❌ Crash del servidor | ✅ 400 Bad Request |
| Validación de vacío | `!correo` (falsy) | `!correoParam.trim()` (más estricto) |
| Código de error | ❌ No incluido | ✅ `TIPO_INVALIDO` |

## Patrón de Validación Segura

Para futuras implementaciones, usar este patrón:

```typescript
// ✅ Patrón seguro para query parameters
const param = req.query.parametro;

// 1. Validar tipo PRIMERO
if (typeof param !== 'string') {
  return res.status(400).json({
    success: false,
    error: "Parámetro debe ser string",
    code: "TIPO_INVALIDO",
  });
}

// 2. Ahora TypeScript sabe que es string (type narrowing)
const valorProcesado = param.toLowerCase().trim();

// 3. Validar contenido
if (!valorProcesado) {
  return res.status(400).json({
    success: false,
    error: "Parámetro requerido",
  });
}
```

## Función Utilitaria Disponible

En `backend/src/middleware/validateCausa.ts` existe una función reutilizable:

```typescript
/**
 * Obtiene un query parameter como string de forma segura
 * Previene HPP (HTTP Parameter Pollution)
 */
function getSafeQueryString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];  // Toma solo el primero si es array
  }
  return undefined;
}
```

## Validación

### Build Exitoso
```bash
> npm run build
> tsc
# Sin errores
```

### Pruebas de Regresión

| Caso | Request | Respuesta Esperada |
|------|---------|-------------------|
| Normal | `?correo=test@test.com` | 200 + disponibilidad |
| Array (HPP) | `?correo=a@t.com&correo=b@t.com` | 400 + TIPO_INVALIDO |
| Vacío | `?correo=` | 400 + Correo requerido |
| Ausente | Sin parámetro | 400 + TIPO_INVALIDO |
| Espacios | `?correo=   ` | 400 + Correo requerido |

## Referencias

- [CWE-1287: Improper Validation of Specified Type of Input](https://cwe.mitre.org/data/definitions/1287.html)
- [Express req.query types](https://expressjs.com/en/api.html#req.query)
- [TypeScript Type Assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)
- [OWASP: Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [HTTP Parameter Pollution](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/04-Testing_for_HTTP_Parameter_Pollution)

## Archivos Relacionados

Esta vulnerabilidad también fue corregida en:

- `backend/src/middleware/validateCausa.ts` - Función `getSafeQueryString()` para causaId

---

**Implementado por**: GitHub Copilot  
**Verificado**: Build exitoso, validación de tipo funcionando
