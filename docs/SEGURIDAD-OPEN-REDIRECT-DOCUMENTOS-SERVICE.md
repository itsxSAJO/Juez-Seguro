# Mitigación de Open Redirect en Servicio de Documentos

## Información del Issue

| Campo | Valor |
|-------|-------|
| **CWE** | CWE-601: URL Redirection to Untrusted Site ('Open Redirect') |
| **Score Snyk** | Reportado en análisis |
| **Archivo Afectado** | `frontend/src/services/documentos.service.ts` |
| **Función** | `verDocumento()` |
| **Fecha de Mitigación** | 2026-01-10 |
| **Estado** | ✅ Mitigado |

---

## Código Vulnerable (Antes)

```typescript
/**
 * Visualiza un documento en una nueva pestaña
 */
async verDocumento(id: string): Promise<void> {
  const token = sessionStorage.getItem("auth_token");
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/documentos/${id}/ver`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("Error al obtener el documento");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  window.open(url, "_blank");  // ⚠️ Snyk marca esto como Open Redirect
  setTimeout(() => window.URL.revokeObjectURL(url), 60000);
}
```

### Problemas Identificados

| # | Problema | Riesgo |
|---|----------|--------|
| 1 | Blob sin validación de MIME type | Podría no ser un PDF |
| 2 | URL no validada antes de `window.open` | Snyk reporta Open Redirect |
| 3 | Sin `noopener,noreferrer` | Nueva ventana puede acceder a `window.opener` |

---

## Código Mitigado (Después)

```typescript
import { secureOpenDocument, validateBlobType } from "../utils/file-security";

/**
 * Visualiza un documento en una nueva pestaña
 * SEGURIDAD: Validación de blob y esquema URL para prevenir Open Redirect
 */
async verDocumento(id: string): Promise<void> {
  const token = sessionStorage.getItem("auth_token");
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/documentos/${id}/ver`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("Error al obtener el documento");
  }

  const blob = await response.blob();
  
  // SEGURIDAD: Validar que sea un PDF antes de abrir
  const validation = validateBlobType(blob);
  if (!validation.isValid) {
    throw new Error(validation.error || "Tipo de archivo no permitido");
  }
  
  // Usar función centralizada que:
  // 1. Valida esquema blob: (previene Open Redirect)
  // 2. Usa noopener,noreferrer (aísla contexto)
  // 3. Limpia URL automáticamente después de 60s
  secureOpenDocument(blob);
}
```

---

## Función Centralizada: `secureOpenDocument()`

Ubicación: `frontend/src/utils/file-security.ts`

```typescript
export function secureOpenDocument(blob: Blob): string {
  // 1. Validar estrictamente que sea PDF
  const validation = validateBlobType(blob);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // 2. Crear URL blob local
  const url = window.URL.createObjectURL(blob);

  // 3. SEGURIDAD: Validación explícita del esquema de URL (CWE-601 mitigation)
  if (!url.startsWith("blob:")) {
    window.URL.revokeObjectURL(url);
    throw new Error("[SEGURIDAD] URL generada no cumple con esquema blob:.");
  }

  // 4. Abrir con flags de aislamiento de contexto
  // snyk:ignore CWE-601 - URL blob: generada localmente, no permite redirección externa
  window.open(url, "_blank", "noopener,noreferrer");

  // 5. Programar limpieza de la URL
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 60000);

  return url;
}
```

---

## Capas de Seguridad Implementadas

| Capa | Control | Descripción |
|------|---------|-------------|
| 1 | **Validación MIME** | `validateBlobType(blob)` verifica que sea `application/pdf` |
| 2 | **Validación esquema** | `url.startsWith("blob:")` confirma origen local |
| 3 | **Aislamiento ventana** | `noopener,noreferrer` previene acceso a `window.opener` |
| 4 | **Limpieza automática** | `revokeObjectURL()` después de 60 segundos |

---

## ¿Por qué es un Falso Positivo?

Las URLs `blob:` generadas por `createObjectURL()`:

1. **Son locales**: Referencian datos en memoria del navegador
2. **Formato fijo**: `blob:<origen-actual>/<UUID>`
3. **Same-origin**: Vinculadas estrictamente al dominio actual
4. **No navegables**: No pueden redirigir a sitios externos

Sin embargo, implementamos validaciones explícitas para:
- Satisfacer requisitos de auditoría
- Aplicar defensa en profundidad
- Documentar el control de seguridad

---

## Comentario de Exclusión para Snyk

Si el escáner persiste después de la mitigación:

```typescript
// snyk:ignore CWE-601 - FALSO POSITIVO: Las URLs de tipo blob: son generadas 
// localmente por window.URL.createObjectURL() y están vinculadas estrictamente 
// al origen actual (same-origin policy). No permiten redirección a dominios 
// externos arbitrarios. Validamos: (1) MIME type = application/pdf, 
// (2) esquema blob:, (3) flags noopener,noreferrer.
```

---

## Archivos Relacionados

| Archivo | Estado |
|---------|--------|
| `frontend/src/utils/file-security.ts` | ✅ Utilidades centralizadas |
| `frontend/src/pages/funcionarios/ExpedienteCausa.tsx` | ✅ Usa `secureOpenDocument()` |
| `frontend/src/pages/funcionarios/EditorDecisiones.tsx` | ✅ Usa `secureDownload()` |
| `frontend/src/services/consulta-ciudadana.service.ts` | ✅ Usa utilidades de seguridad |
| `docs/SEGURIDAD-OPEN-REDIRECT-BLOB-URL.md` | Documentación general del patrón |

---

## Referencias

- [CWE-601: URL Redirection to Untrusted Site](https://cwe.mitre.org/data/definitions/601.html)
- [MDN: URL.createObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL)
- [MDN: window.open() - noopener](https://developer.mozilla.org/en-US/docs/Web/API/Window/open#noopener)
