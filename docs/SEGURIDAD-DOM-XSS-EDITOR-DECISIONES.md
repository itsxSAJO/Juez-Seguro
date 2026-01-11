# Mitigación de DOM XSS en Editor de Decisiones

## Información del Issue

| Campo | Valor |
|-------|-------|
| **CWE** | CWE-79: Improper Neutralization of Input During Web Page Generation (DOM XSS) |
| **Score Snyk** | 518 |
| **Archivo Afectado** | `frontend/src/pages/funcionarios/EditorDecisiones.tsx` |
| **Función** | `handleDescargarPdf()` |
| **Fecha de Mitigación** | 2026-01-10 |
| **Estado** | ✅ Mitigado |

---

## Código Vulnerable (Antes)

```typescript
const handleDescargarPdf = async () => {
  if (!decisionActual || decisionActual.estado !== "FIRMADA") return;

  try {
    const blob = await decisionesService.descargarPdfFirmado(decisionActual.decisionId);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // ⚠️ decisionId fluye sin validación hacia el DOM
    a.download = `decision_${decisionActual.decisionId}_firmada.pdf`;
    // ⚠️ Snyk marca appendChild como sink de DOM XSS
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    // ...
  }
};
```

### Problemas Identificados

| # | Problema | Riesgo |
|---|----------|--------|
| 1 | `decisionId` no sanitizado | Inyección de caracteres peligrosos en nombre de archivo |
| 2 | Blob sin validar | Podría no ser un PDF legítimo |
| 3 | Manejo manual del DOM | Código duplicado, propenso a errores |
| 4 | `revokeObjectURL` síncrono | Podría ejecutarse antes de iniciar la descarga |

---

## Código Mitigado (Después)

```typescript
import { secureDownload, validateBlobType } from "@/utils/file-security";

const handleDescargarPdf = async () => {
  if (!decisionActual || decisionActual.estado !== "FIRMADA") return;

  try {
    const blob = await decisionesService.descargarPdfFirmado(decisionActual.decisionId);
    
    // SEGURIDAD: Validar que el blob sea un PDF válido antes de procesar
    const validation = validateBlobType(blob);
    if (!validation.isValid) {
      toast({
        variant: "destructive",
        title: "Error de seguridad",
        description: validation.error || "El archivo recibido no es un PDF válido",
      });
      return;
    }
    
    // SEGURIDAD: Construir nombre con ID convertido a string (defensa en profundidad)
    // sanitizeFilename() se aplica internamente en secureDownload()
    const nombreArchivo = `decision_${String(decisionActual.decisionId)}_firmada.pdf`;
    
    // Usar función centralizada que valida, sanitiza y maneja el DOM de forma segura
    secureDownload(blob, nombreArchivo);
    
  } catch (error) {
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "No se pudo descargar el PDF",
      variant: "destructive",
    });
  }
};
```

---

## Capas de Seguridad Implementadas

| Capa | Control | Descripción |
|------|---------|-------------|
| 1 | **Validación MIME** | `validateBlobType(blob)` verifica que sea `application/pdf` |
| 2 | **Conversión explícita** | `String(decisionActual.decisionId)` previene tipos inesperados |
| 3 | **Sanitización** | `sanitizeFilename()` elimina caracteres peligrosos |
| 4 | **DOM aislado** | Elemento `<a>` con `display: none` |
| 5 | **Limpieza async** | `revokeObjectURL()` con timeout de 1 segundo |

---

## Función Centralizada: `secureDownload()`

Ubicación: `frontend/src/utils/file-security.ts`

```typescript
export function secureDownload(blob: Blob, filename: string): void {
  // 1. Validar el blob antes de procesar
  const validation = validateBlobType(blob);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // 2. Sanitizar el nombre (doble validación)
  const safeName = sanitizeFilename(filename);

  // 3. Crear URL temporal
  const url = window.URL.createObjectURL(blob);

  try {
    // 4. Crear elemento ancla de forma aislada
    const anchor = document.createElement("a");
    anchor.style.display = "none";
    anchor.href = url;
    anchor.download = safeName;
    
    // 5. Agregar al DOM, ejecutar click, y remover inmediatamente
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    // 6. Limpiar la URL con delay para permitir la descarga
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 1000);
  }
}
```

---

## Beneficios de la Refactorización

### Seguridad
- ✅ Validación explícita del tipo de archivo recibido
- ✅ Sanitización de nombres de archivo
- ✅ Protección contra inyección en atributos del DOM

### Mantenibilidad
- ✅ Código centralizado y reutilizable
- ✅ Consistencia con otros componentes (`ExpedienteCausa.tsx`)
- ✅ Fácil de auditar y actualizar

### Robustez
- ✅ Manejo de errores mejorado con mensajes descriptivos
- ✅ Limpieza garantizada de recursos (URL blob)
- ✅ Elemento DOM invisible para evitar parpadeos

---

## Archivos Relacionados

| Archivo | Propósito |
|---------|-----------|
| `frontend/src/utils/file-security.ts` | Utilidades centralizadas de seguridad |
| `frontend/src/pages/funcionarios/ExpedienteCausa.tsx` | Otro componente que usa las mismas utilidades |
| `docs/SEGURIDAD-DOM-XSS-DOCUMENTOS.md` | Documentación del fix similar en ExpedienteCausa |

---

## Referencias

- [CWE-79: Improper Neutralization of Input](https://cwe.mitre.org/data/definitions/79.html)
- [OWASP DOM Based XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- [MDN: URL.createObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL)
