# Mitigación de DOM XSS en Servicio de Consulta Ciudadana

## Información del Issue

| Campo | Valor |
|-------|-------|
| **CWE** | CWE-79: Improper Neutralization of Input During Web Page Generation (DOM XSS) |
| **Score Snyk** | 518 |
| **Archivo Afectado** | `frontend/src/services/consulta-ciudadana.service.ts` |
| **Funciones** | `descargarDocumento()`, `verDocumento()` |
| **Fecha de Mitigación** | 2026-01-10 |
| **Estado** | ✅ Mitigado |

---

## Código Vulnerable (Antes)

### `descargarDocumento()`

```typescript
async descargarDocumento(documentoId: string, nombreArchivo: string): Promise<void> {
  try {
    // ⚠️ URL hardcodeada
    const response = await fetch(`http://localhost:3000/api/publico/documentos/${documentoId}/descargar`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Error al descargar el documento");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    // ⚠️ Manipulación del DOM sin validación
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;  // ⚠️ Sin sanitizar - Snyk marca esto
    document.body.appendChild(a);  // ⚠️ Sink DOM XSS
    a.click();
    document.body.removeChild(a);
    
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error al descargar documento:", error);  // ⚠️ Expone información
    throw new Error("No se pudo descargar el documento");
  }
}
```

### `verDocumento()`

```typescript
verDocumento(documentoId: string): void {
  const url = `http://localhost:3000/api/publico/documentos/${documentoId}/ver`;
  window.open(url, "_blank");  // ⚠️ Sin noopener,noreferrer
}
```

### Problemas Identificados

| # | Problema | Riesgo |
|---|----------|--------|
| 1 | `nombreArchivo` sin sanitizar | Inyección en atributo `download` |
| 2 | Blob sin validación | Podría no ser un PDF |
| 3 | URL hardcodeada `localhost:3000` | No usa variable de entorno |
| 4 | Manejo manual del DOM | Código duplicado, propenso a errores |
| 5 | `console.error` expone información | Información de debug en producción |
| 6 | `window.open` sin flags | Nueva ventana puede acceder a `window.opener` |

---

## Código Mitigado (Después)

### Imports Agregados

```typescript
import { secureDownload, validateBlobType } from "../utils/file-security";
```

### `descargarDocumento()` Refactorizado

```typescript
/**
 * Descarga un documento público
 * No requiere autenticación
 * SEGURIDAD: Validación de blob y sanitización de nombre de archivo
 */
async descargarDocumento(documentoId: string, nombreArchivo: string): Promise<void> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    const response = await fetch(`${apiUrl}/publico/documentos/${documentoId}/descargar`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Error al descargar el documento");
    }

    const blob = await response.blob();
    
    // SEGURIDAD: Validar que sea un PDF antes de descargar
    const validation = validateBlobType(blob);
    if (!validation.isValid) {
      throw new Error(validation.error || "Tipo de archivo no permitido");
    }
    
    // Usar función centralizada (sanitiza nombre, maneja DOM de forma segura)
    secureDownload(blob, nombreArchivo);
    
  } catch (error) {
    // Evitar exponer detalles técnicos en producción
    throw new Error("No se pudo descargar el documento");
  }
}
```

### `verDocumento()` Refactorizado

```typescript
/**
 * Abre un documento para visualización en nueva pestaña
 * No requiere autenticación
 * SEGURIDAD: Usa noopener,noreferrer para aislar el contexto
 */
verDocumento(documentoId: string): void {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
  const url = `${apiUrl}/publico/documentos/${documentoId}/ver`;
  // SEGURIDAD: noopener previene acceso a window.opener, noreferrer no envía Referer
  window.open(url, "_blank", "noopener,noreferrer");
}
```

---

## Capas de Seguridad Implementadas

| Capa | Control | Descripción |
|------|---------|-------------|
| 1 | **Validación MIME** | `validateBlobType(blob)` verifica que sea `application/pdf` |
| 2 | **Sanitización** | `secureDownload()` usa `sanitizeFilename()` internamente |
| 3 | **DOM aislado** | Elemento `<a>` con `display: none` |
| 4 | **Limpieza async** | `revokeObjectURL()` con timeout de 1 segundo |
| 5 | **Aislamiento ventana** | `noopener,noreferrer` en `window.open()` |
| 6 | **URLs externalizadas** | `import.meta.env.VITE_API_URL` |
| 7 | **Errores genéricos** | Sin exponer detalles técnicos |

---

## Consideraciones Especiales

### Este es un Servicio, no un Componente

El archivo `consulta-ciudadana.service.ts` es un servicio que:

- ❌ No tiene acceso a hooks de React (`useToast`)
- ✅ Lanza errores que el componente consumidor debe capturar
- ✅ Los mensajes de error son genéricos para no exponer detalles

### Uso Recomendado en Componentes

```typescript
// En el componente que usa el servicio
try {
  await consultaCiudadanaService.descargarDocumento(docId, nombre);
} catch (error) {
  toast({
    variant: "destructive",
    title: "Error",
    description: error instanceof Error ? error.message : "Error al descargar",
  });
}
```

---

## Archivos Relacionados

| Archivo | Propósito |
|---------|-----------|
| `frontend/src/utils/file-security.ts` | Utilidades centralizadas de seguridad |
| `frontend/src/pages/funcionarios/ExpedienteCausa.tsx` | Componente que usa patrón similar |
| `frontend/src/pages/funcionarios/EditorDecisiones.tsx` | Componente que usa patrón similar |
| `docs/SEGURIDAD-DOM-XSS-DOCUMENTOS.md` | Documentación de fix relacionado |

---

## Referencias

- [CWE-79: Improper Neutralization of Input](https://cwe.mitre.org/data/definitions/79.html)
- [OWASP DOM Based XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- [MDN: window.open() - noopener](https://developer.mozilla.org/en-US/docs/Web/API/Window/open#noopener)
