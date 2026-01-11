# Mitigación de DOM XSS en Manejo de Documentos

**Fecha:** 10 de enero de 2026  
**Severidad Original:** 568 (Media-Alta)  
**Herramienta de Detección:** Snyk  
**CWE:** CWE-79 (Cross-site Scripting)  
**Estado:** ✅ MITIGADO  

---

## 1. Descripción de la Vulnerabilidad

### 1.1 Ubicación
- **Archivo:** `frontend/src/pages/funcionarios/ExpedienteCausa.tsx`
- **Funciones Afectadas:**
  - `handleVerDocumento()` - Líneas 309-331
  - `handleDescargarDocumento()` - Líneas 334-362

### 1.2 Código Vulnerable Original

```typescript
// handleVerDocumento - VULNERABLE
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
window.open(url, "_blank");  // ← Si blob es HTML/JS, el navegador lo ejecuta

// handleDescargarDocumento - VULNERABLE
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = nombreArchivo;  // ← nombreArchivo sin sanitizar
document.body.appendChild(a);  // ← Sink DOM peligroso
a.click();
```

### 1.3 Vectores de Ataque

| Vector | Función Afectada | Riesgo |
|--------|------------------|--------|
| Blob con contenido HTML/JS | `handleVerDocumento` | Alto - `window.open()` ejecuta scripts |
| Blob SVG con scripts | Ambas | Alto - SVG puede contener JavaScript |
| `nombreArchivo` malicioso | `handleDescargarDocumento` | Medio - Header injection |
| MIME type falsificado | Ambas | Medio - Bypass de validaciones |

---

## 2. Solución Implementada

### 2.1 Nuevo Módulo de Seguridad

Se creó `frontend/src/utils/file-security.ts` con funciones centralizadas:

```typescript
// Tipos permitidos (solo PDFs por política)
const ALLOWED_MIME_TYPES = ["application/pdf"];

// Tipos explícitamente peligrosos
const DANGEROUS_MIME_TYPES = [
  "text/html", "application/javascript", "image/svg+xml", // etc.
];

// Funciones exportadas:
export function validateBlobType(blob: Blob): BlobValidationResult;
export function sanitizeFilename(filename: string): string;
export function secureDownload(blob: Blob, filename: string): void;
export function secureOpenDocument(blob: Blob): string;
```

### 2.2 Validación de MIME Type

```typescript
export function validateBlobType(blob: Blob): BlobValidationResult {
  const detectedType = blob.type || "unknown";

  // Rechazar tipos peligrosos
  if (DANGEROUS_MIME_TYPES.some(d => detectedType.includes(d))) {
    return {
      isValid: false,
      error: `Tipo de archivo no permitido: ${detectedType}`,
      detectedType,
    };
  }

  // Solo permitir tipos en whitelist
  if (!ALLOWED_MIME_TYPES.includes(detectedType)) {
    return {
      isValid: false,
      error: `Tipo no reconocido: ${detectedType}`,
      detectedType,
    };
  }

  return { isValid: true, detectedType };
}
```

### 2.3 Sanitización de Nombres de Archivo

```typescript
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[\x00-\x1f\x7f]/g, "")      // Caracteres de control
    .replace(/[<>:"/\\|?*]/g, "_")         // Caracteres peligrosos
    .replace(/\.{2,}/g, ".")               // Path traversal
    .replace(/[^a-zA-Z0-9._-]/g, "_")      // Solo caracteres seguros
    .slice(0, 255)                          // Límite de longitud
    + ".pdf";                               // Forzar extensión
}
```

### 2.4 Descarga Segura

```typescript
export function secureDownload(blob: Blob, filename: string): void {
  // Validar tipo antes de procesar
  const validation = validateBlobType(blob);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const safeName = sanitizeFilename(filename);
  const url = window.URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.style.display = "none";  // Aislado del DOM visible
    anchor.href = url;
    anchor.download = safeName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  }
}
```

### 2.5 Apertura Segura de Documentos

```typescript
export function secureOpenDocument(blob: Blob): string {
  const validation = validateBlobType(blob);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const url = window.URL.createObjectURL(blob);
  // noopener,noreferrer previenen acceso al contexto padre
  window.open(url, "_blank", "noopener,noreferrer");
  
  setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  return url;
}
```

---

## 3. Código Corregido

### 3.1 handleVerDocumento

```typescript
const handleVerDocumento = async (docId: string) => {
  try {
    const response = await fetch(`/api/documentos/${docId}/ver`, { /* ... */ });
    const blob = await response.blob();
    
    // SEGURIDAD: Validar tipo antes de abrir
    const validation = validateBlobType(blob);
    if (!validation.isValid) {
      console.error("[SEGURIDAD] Archivo no permitido:", validation.detectedType);
      alert(`Error de seguridad: ${validation.error}`);
      return;
    }

    secureOpenDocument(blob);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Error");
  }
};
```

### 3.2 handleDescargarDocumento

```typescript
const handleDescargarDocumento = async (docId: string, nombreArchivo: string) => {
  try {
    const response = await fetch(`/api/documentos/${docId}/descargar`, { /* ... */ });
    const blob = await response.blob();
    
    // SEGURIDAD: Validar tipo antes de descargar
    const validation = validateBlobType(blob);
    if (!validation.isValid) {
      console.error("[SEGURIDAD] Archivo no permitido:", validation.detectedType);
      alert(`Error de seguridad: ${validation.error}`);
      return;
    }

    // SEGURIDAD: Sanitizar nombre
    const safeName = sanitizeFilename(nombreArchivo);
    secureDownload(blob, safeName);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Error");
  }
};
```

---

## 4. Matriz de Mitigación

| Vector de Ataque | Protección | Resultado |
|------------------|------------|-----------|
| Blob HTML/JS | `validateBlobType()` rechaza | ❌ Bloqueado |
| Blob SVG con scripts | `DANGEROUS_MIME_TYPES` incluye SVG | ❌ Bloqueado |
| Blob imagen | `ALLOWED_MIME_TYPES` solo permite PDF | ❌ Bloqueado |
| MIME type desconocido | Whitelist estricta | ❌ Bloqueado |
| Nombre con `<script>` | `sanitizeFilename()` elimina `<>` | ✅ Neutralizado |
| Path traversal (`../`) | `sanitizeFilename()` elimina `..` | ✅ Neutralizado |
| Caracteres de control | `sanitizeFilename()` los elimina | ✅ Neutralizado |
| Acceso al contexto padre | `noopener,noreferrer` en `window.open` | ✅ Bloqueado |

---

## 5. Política de Tipos de Archivo

### 5.1 Tipos Permitidos

| MIME Type | Permitido | Razón |
|-----------|-----------|-------|
| `application/pdf` | ✅ | Documentos judiciales |

### 5.2 Tipos Bloqueados Explícitamente

| MIME Type | Razón del Bloqueo |
|-----------|-------------------|
| `text/html` | Ejecución de scripts |
| `application/javascript` | Código ejecutable |
| `image/svg+xml` | SVG puede contener `<script>` |
| `text/xml`, `application/xml` | Puede contener scripts |
| `image/*` (todos) | Política de solo PDFs |

---

## 6. Defensa en Profundidad

Esta mitigación del frontend complementa las protecciones del backend:

| Capa | Protección |
|------|------------|
| **Backend (subida)** | Validación de magic bytes al subir |
| **Backend (descarga)** | Headers `X-Content-Type-Options: nosniff` |
| **Frontend (recepción)** | Validación de `blob.type` |
| **Frontend (nombre)** | Sanitización de `nombreArchivo` |
| **Frontend (DOM)** | Manejo aislado de elementos `<a>` |

---

## 7. Referencias

- [CWE-79: Cross-site Scripting](https://cwe.mitre.org/data/definitions/79.html)
- [OWASP: DOM Based XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- [MDN: window.open() Security](https://developer.mozilla.org/en-US/docs/Web/API/Window/open#security)

---

## 8. Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/utils/file-security.ts` | **Nuevo** - Funciones de seguridad centralizadas |
| `frontend/src/pages/funcionarios/ExpedienteCausa.tsx` | Uso de funciones seguras |

---

## 9. Historial

| Fecha | Versión | Descripción |
|-------|---------|-------------|
| 2026-01-10 | 1.0 | Implementación de validación y sanitización |
