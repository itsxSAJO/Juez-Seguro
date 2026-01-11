# Corrección de Seguridad: Cookie sin Flag Secure (CWE-614)

## Información de la Vulnerabilidad

| Campo | Valor |
|-------|-------|
| **CWE** | CWE-614: Sensitive Cookie in HTTPS Session Without 'Secure' Attribute |
| **Severidad** | Media |
| **CVSS** | 4.3 |
| **Archivo Afectado** | `frontend/src/components/ui/sidebar.tsx` |
| **Línea** | 68 |
| **Herramienta de Detección** | Snyk Code |
| **Fecha de Corrección** | 2026-01-10 |

## Descripción del Problema

La cookie del estado del sidebar se configuraba sin los atributos de seguridad `Secure` y `SameSite`, lo que exponía la aplicación a dos riesgos:

1. **Transmisión insegura**: Sin el flag `Secure`, la cookie podía transmitirse sobre conexiones HTTP no cifradas, permitiendo que atacantes en la red intercepten el valor.

2. **Vulnerabilidad CSRF**: Sin el flag `SameSite`, la cookie se enviaba en todas las solicitudes cross-site, facilitando ataques Cross-Site Request Forgery.

## Código Vulnerable

```typescript
// sidebar.tsx - Línea 68
// This sets the cookie to keep the sidebar state.
document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
```

### Análisis del Riesgo

Aunque esta cookie específica (`sidebar:state`) solo almacena preferencias de UI (no datos sensibles), la ausencia de flags de seguridad:

1. **Viola mejores prácticas**: Todas las cookies en aplicaciones HTTPS deben usar `Secure`
2. **Establece mal precedente**: Código sin flags de seguridad puede copiarse para cookies más sensibles
3. **Incumple estándares**: OWASP recomienda siempre establecer estos flags

## Solución Implementada

```typescript
// sidebar.tsx - Línea 68 (corregido)
// This sets the cookie to keep the sidebar state.
// Security: SameSite=Lax prevents CSRF, Secure ensures HTTPS-only transmission
document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
```

## Flags de Seguridad Agregados

### Flag `Secure`

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | La cookie solo se transmite sobre conexiones HTTPS |
| **Protección** | Previene interceptación en redes no seguras (ataques MITM) |
| **Comportamiento** | En HTTP localhost durante desarrollo, la cookie no se enviará |

### Flag `SameSite=Lax`

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | Controla cuándo se envía la cookie en solicitudes cross-site |
| **Valor `Lax`** | Cookie se envía en navegación top-level pero NO en solicitudes POST cross-site |
| **Protección** | Mitiga ataques CSRF sin romper flujos de navegación normales |

### Comparación de valores SameSite

| Valor | Comportamiento | Uso Recomendado |
|-------|----------------|-----------------|
| `Strict` | Nunca envía en solicitudes cross-site | Cookies muy sensibles (auth) |
| `Lax` | Envía en navegación, no en POST cross-site | Balance seguridad/usabilidad |
| `None` | Siempre envía (requiere `Secure`) | Integraciones third-party |

## Consideraciones de Desarrollo

### Desarrollo Local (localhost)

El flag `Secure` puede causar que la cookie no funcione en `http://localhost`. Soluciones:

1. **Usar HTTPS local**: Configurar certificados de desarrollo
2. **Condición de entorno** (si fuera necesario):
   ```typescript
   const secureFlag = location.protocol === 'https:' ? '; Secure' : '';
   document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag}`;
   ```

> **Nota**: En este caso, como es una preferencia de UI no crítica, es aceptable que no funcione en HTTP durante desarrollo.

## Validación

### Build Exitoso
```
✓ 2618 modules transformed.
✓ built in 6.64s
```

### Verificación Manual

1. Abrir DevTools → Application → Cookies
2. Verificar que la cookie `sidebar:state` muestre:
   - ✅ Secure: Yes (checkmark)
   - ✅ SameSite: Lax

## Referencias

- [CWE-614: Sensitive Cookie Without 'Secure' Flag](https://cwe.mitre.org/data/definitions/614.html)
- [OWASP: Secure Cookie Attribute](https://owasp.org/www-community/controls/SecureCookieAttribute)
- [MDN: Set-Cookie SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [RFC 6265bis: Cookies](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis)

## Checklist de Cookies Seguras

Para futuras implementaciones de cookies en el proyecto:

- [ ] **Secure**: Siempre en producción HTTPS
- [ ] **SameSite**: `Lax` por defecto, `Strict` para auth
- [ ] **HttpOnly**: Si la cookie no necesita acceso desde JavaScript
- [ ] **Path**: Lo más restrictivo posible
- [ ] **Max-Age/Expires**: Tiempo mínimo necesario
- [ ] **Domain**: No especificar a menos que sea necesario (más restrictivo)

---

**Implementado por**: GitHub Copilot  
**Verificado**: Build exitoso, sin errores de compilación
