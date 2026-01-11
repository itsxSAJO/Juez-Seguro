# Mitigación de Open Redirect en URLs Blob (CWE-601)

## Información del Issue

| Campo | Valor |
|-------|-------|
| **CWE** | CWE-601: URL Redirection to Untrusted Site ('Open Redirect') |
| **Score Snyk** | 562 |
| **Archivo Afectado** | `frontend/src/utils/file-security.ts` (función `secureOpenDocument`) |
| **Archivo Original Reportado** | `frontend/src/pages/funcionarios/ExpedienteCausa.tsx` |
| **Fecha de Mitigación** | 2026-01-10 |
| **Estado** | ✅ Mitigado / Falso Positivo Documentado |

---

## Código Reportado por Snyk

```typescript
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
// Snyk marca la siguiente línea como vulnerabilidad de Redirección Abierta
window.open(url, "_blank");
```

---

## Análisis Técnico: ¿Es un Falso Positivo?

### Sí, es un Falso Positivo

Las URLs generadas por `window.URL.createObjectURL()` tienen las siguientes características que las hacen **inmunes a Open Redirect**:

| Característica | Descripción |
|----------------|-------------|
| **Generación Local** | `createObjectURL()` crea una referencia a datos en memoria del navegador, no a un recurso externo |
| **Formato Fijo** | Siempre sigue el patrón `blob:<origen-actual>/<UUID>` |
| **Same-Origin Policy** | El navegador vincula estrictamente la URL al origen que la creó |
| **No Navegable Externamente** | El usuario no puede escribir una URL `blob:` para acceder a sitios externos |
| **Efímera** | La URL solo existe mientras el documento está abierto o hasta que se llame `revokeObjectURL()` |

### Ejemplo de URL Generada

```
blob:https://juez-seguro.gob.ec/550e8400-e29b-41d4-a716-446655440000
```

Esta URL:
- ❌ NO puede redirigir a `https://sitio-malicioso.com`
- ❌ NO puede ser manipulada por parámetros de query string
- ✅ Solo referencia datos locales en memoria del navegador

---

## Mitigación Implementada (Defensa en Profundidad)

Aunque es un falso positivo, implementamos validaciones explícitas para:
1. Satisfacer los requisitos de auditoría y escáneres SAST
2. Aplicar el principio de "Defensa en Profundidad"
3. Documentar el control de seguridad de forma auditable

### Archivo: `frontend/src/utils/file-security.ts`

```typescript
export function secureOpenDocument(blob: Blob): string {
  // CAPA 1: Validar estrictamente que sea PDF
  const validation = validateBlobType(blob);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // Crear URL blob local
  const url = window.URL.createObjectURL(blob);

  // CAPA 2: Validación explícita del esquema de URL (CWE-601 mitigation)
  // Las URLs de createObjectURL SIEMPRE comienzan con "blob:" seguido del origen actual.
  // Esta validación es defensa en profundidad y satisface requisitos de auditoría.
  if (!url.startsWith("blob:")) {
    // Limpiar URL malformada inmediatamente
    window.URL.revokeObjectURL(url);
    throw new Error(
      "[SEGURIDAD] URL generada no cumple con esquema blob:. " +
      "Posible manipulación detectada. Operación cancelada."
    );
  }

  // CAPA 3: Abrir con flags de aislamiento de contexto
  // noopener: Previene que la nueva ventana acceda a window.opener
  // noreferrer: No envía header Referer y también implica noopener
  window.open(url, "_blank", "noopener,noreferrer");

  // CAPA 4: Programar limpieza de la URL después de un tiempo razonable
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 60000); // 1 minuto

  return url;
}
```

---

## Capas de Seguridad

| Capa | Control | Propósito |
|------|---------|-----------|
| 1 | `validateBlobType(blob)` | Solo permite MIME type `application/pdf` |
| 2 | `url.startsWith("blob:")` | Confirma que la URL es de origen local |
| 3 | `noopener,noreferrer` | Aísla la ventana abierta del contexto padre |
| 4 | `revokeObjectURL()` | Limpia la referencia temporal después de uso |

---

## Comentario de Exclusión para Snyk

Si el escáner continúa reportando el issue después de la mitigación, usar:

```typescript
// snyk:ignore CWE-601 - FALSO POSITIVO: Las URLs de tipo blob: son generadas 
// localmente por window.URL.createObjectURL() y están vinculadas estrictamente 
// al origen actual (same-origin policy). No permiten redirección a dominios 
// externos arbitrarios. El esquema blob: no es navegable por el usuario y solo 
// sirve como referencia temporal a datos en memoria del navegador.
// Adicionalmente validamos: (1) MIME type = application/pdf, (2) esquema blob:,
// (3) flags noopener,noreferrer. Referencia: MDN Web Docs - URL.createObjectURL()
```

---

## Referencias

- [MDN Web Docs - URL.createObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL)
- [CWE-601: URL Redirection to Untrusted Site](https://cwe.mitre.org/data/definitions/601.html)
- [OWASP - Unvalidated Redirects and Forwards](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/04-Testing_for_Client-side_URL_Redirect)

---

## Conclusión

El reporte de Snyk es un **falso positivo** porque `createObjectURL()` genera URLs locales que no pueden redirigir a sitios externos. Sin embargo, hemos implementado validaciones explícitas como práctica de "Defensa en Profundidad" para:

1. ✅ Demostrar control sobre el destino de `window.open()`
2. ✅ Satisfacer requisitos de auditoría de seguridad
3. ✅ Documentar la decisión técnica para futuras revisiones
4. ✅ Prevenir regresiones si el código se modifica en el futuro
