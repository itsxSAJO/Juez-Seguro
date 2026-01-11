# HU-UP-001: Consulta del Expediente Electrónico de Mi Proceso

| Campo | Valor |
| ----- | ----- |
| **ID** | HU-UP-001 |
| **Título** | Consulta del expediente electrónico de mi proceso |
| **Sprint** | 4 |
| **Estado** | ✅ Completado |
| **Fecha Implementación** | Enero 2026 |

---

## 1. Descripción de la Historia de Usuario

**Como** ciudadano,  
**Quiero** consultar el expediente electrónico de mi proceso judicial,  
**Para** conocer el estado actual, las actuaciones realizadas y descargar los documentos públicos sin necesidad de autenticación.

---

## 2. Criterios de Aceptación Implementados

### CP-001: Búsqueda por Número de Proceso ✅
- [x] El ciudadano puede buscar un proceso por su número (formato: PPCCC-AAAA-NNNNN)
- [x] Validación de formato con expresión regular antes de consultar la base de datos
- [x] Mensaje de error claro cuando el formato es inválido
- [x] Mensaje informativo cuando el proceso no existe

### CP-002: Búsqueda por Actor/Ofendido ✅
- [x] El ciudadano puede buscar procesos donde aparece como actor
- [x] Búsqueda parcial (ILIKE) en el campo `actor_nombre`
- [x] Resultados paginados

### CP-003: Búsqueda por Demandado/Procesado ✅
- [x] El ciudadano puede buscar procesos donde aparece como demandado
- [x] Búsqueda parcial (ILIKE) en el campo `demandado_nombre`
- [x] Resultados paginados

### CP-004: Visualización de Información del Proceso ✅
- [x] Número de expediente
- [x] Fecha de ingreso
- [x] Dependencia judicial (Unidad Judicial)
- [x] Materia (Civil, Penal, Laboral, etc.)
- [x] Tipo de acción
- [x] Estado procesal (INICIADA, EN_TRÁMITE, RESUELTA, ARCHIVADA, SUSPENDIDA)

### CP-005: Datos Anonimizados (FDP_IFF) ✅
- [x] Actor mostrado con nombre genérico o pseudónimo
- [x] Demandado mostrado con nombre genérico o pseudónimo
- [x] Juez mostrado solo con pseudónimo (ej: J5-442)
- [x] Funcionarios en actuaciones mostrados con pseudónimo

### CP-006: Timeline de Actuaciones Procesales ✅
- [x] Lista cronológica de actuaciones (documentos)
- [x] Tipo de actuación (Demanda, Auto, Providencia, etc.)
- [x] Fecha de la actuación
- [x] Descripción/nombre del documento
- [x] Responsable anonimizado (pseudónimo)

### CP-007: Descarga de Documentos Públicos ✅
- [x] Botón "Ver documento" para visualización en navegador
- [x] Botón "Descargar" para descarga del archivo
- [x] Solo documentos con archivo disponible muestran los botones
- [x] Sin necesidad de autenticación

---

## 3. Controles de Seguridad Implementados

### 3.1 Rate Limiting (FIA_AFL.1)
```typescript
// Configuración: 15 peticiones por minuto por IP
const publicSearchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 15,
  message: {
    success: false,
    error: "Demasiadas consultas. Por favor espere un momento.",
    code: "RATE_LIMIT_EXCEEDED"
  }
});
```

### 3.2 Delay Progresivo (Anti-Abuse)
| Intentos Fallidos | Delay Aplicado |
| ----------------- | -------------- |
| 0 | 0 segundos |
| 1 | 1 segundo |
| 2 | 2 segundos |
| 3 | 4 segundos |
| 4 | 8 segundos |
| 5+ | Bloqueo por 15 minutos |

### 3.3 Validación de Formato de Número de Proceso
```typescript
// Regex para formato ecuatoriano: PPCCC-AAAA-NNNNN
const CAUSA_REGEX = /^(0[1-9]|1[0-9]|2[0-4])\d{3}-20\d{2}-\d{5}[A-Z]?$/;

// PP: Código de provincia (01-24)
// CCC: Código de unidad judicial
// AAAA: Año (20XX)
// NNNNN: Número secuencial
```

### 3.4 Validación de IDs de Documentos
```typescript
// Acepta UUIDs y IDs simples alfanuméricos
const idRegex = /^[a-zA-Z0-9-]{3,50}$/;
```

### 3.5 Auditoría de Acceso Público (FAU_GEN.1)
Todos los accesos públicos se registran en `db_logs`:
- `CONSULTA_PUBLICA`: Búsqueda de proceso por número
- `LISTADO_CAUSAS`: Listado con filtros
- `CONSULTA_ACTUACIONES`: Consulta de timeline
- `VISTA_DOCUMENTO_PUBLICO`: Visualización de documento
- `DESCARGA_DOCUMENTO_PUBLICO`: Descarga de documento

Datos registrados:
- IP de origen
- User-Agent
- Número de proceso consultado
- Resultado (éxito/fallo)
- Timestamp

---

## 4. Arquitectura de la Implementación

### 4.1 Endpoints del Backend

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/publico/buscar` | Buscar proceso por número |
| POST | `/api/publico/buscar` | Buscar proceso por número (POST) |
| GET | `/api/publico/procesos/:numeroProceso` | Detalle de un proceso |
| GET | `/api/publico/procesos/:numeroProceso/actuaciones` | Actuaciones del proceso |
| GET | `/api/publico/documentos/:documentoId/ver` | Ver documento (inline) |
| GET | `/api/publico/documentos/:documentoId/descargar` | Descargar documento |
| GET | `/api/publico/causas` | Listar causas con filtros |
| GET | `/api/publico/validar` | Validar formato de expediente |
| GET | `/api/publico/materias` | Catálogo de materias |
| GET | `/api/publico/unidades-judiciales` | Catálogo de unidades |

### 4.2 Flujo de Datos

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Portal         │     │    Backend       │     │   PostgreSQL    │
│  Ciudadano      │────▶│    Express       │────▶│   db_casos      │
│  (React)        │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                        │
        │                       │                        │
        ▼                       ▼                        ▼
   ┌─────────┐           ┌─────────────┐         ┌─────────────┐
   │ Sin     │           │ Rate Limit  │         │ causas      │
   │ Auth    │           │ + Delay     │         │ documentos  │
   └─────────┘           │ + Audit     │         │ mapa_pseudo │
                         └─────────────┘         └─────────────┘
```

### 4.3 Componentes del Frontend

| Componente | Ruta | Descripción |
| ---------- | ---- | ----------- |
| `ConsultaCiudadana.tsx` | `/ciudadano` | Página principal de búsqueda |
| `ProcesoDetalle.tsx` | `/ciudadano/proceso/:numeroProceso` | Detalle del proceso |
| `ResultsTable.tsx` | - | Tabla de resultados de búsqueda |
| `SearchForm.tsx` | - | Formulario de búsqueda |

### 4.4 Servicios del Frontend

```typescript
// consulta-ciudadana.service.ts
consultaCiudadanaService = {
  buscarPorNumero(numeroProceso: string): Promise<ProcesoPublico | null>
  buscarProcesos(query, tipo, page, pageSize): Promise<PaginatedResponse<ProcesoPublico>>
  getProcesoById(numeroProceso: string): Promise<ProcesoPublico | null>
  getActuaciones(numeroProceso: string): Promise<Actuacion[]>
  descargarDocumento(documentoId: string, nombreArchivo: string): Promise<void>
  verDocumento(documentoId: string): void
}
```

---

## 5. Transformación de Datos

### 5.1 Backend → Frontend (Proceso)

```typescript
// Backend (CausaPublica)          →  Frontend (ProcesoPublico)
{
  causaId: 1,                         id: "1",
  numeroProceso: "17332-2024-00001",  numeroExpediente: "17332-2024-00001",
  fechaCreacion: "2024-01-15",        fechaIngreso: "15/1/2024",
  unidadJudicial: "...",              dependencia: "...",
  materia: "Civil",                   materia: "Civil",
  tipoProceso: "Ordinario",           tipoAccion: "Ordinario",
  estadoProcesal: "INICIADA",         estado: "INICIADA",
  juezPseudonimo: "J5-442",           juezAnonimo: "J5-442",
  actorNombre: "Actor Anónimo",       actorAnonimo: "Actor Anónimo",
  demandadoNombre: "Demandado...",    demandadoAnonimo: "Demandado..."
}
```

### 5.2 Backend → Frontend (Actuación)

```typescript
// Backend (ActuacionPublica)        →  Frontend (Actuacion)
{
  actuacionId: "doc-001",             id: "doc-001",
  tipoActuacion: "Demanda",           tipo: "Demanda",
  fechaActuacion: "2024-01-15T...",   fecha: "15/1/2024",
  descripcion: "Demanda Inicial",     descripcion: "Demanda Inicial",
  funcionarioPseudonimo: "S3-127",    responsableAnonimo: "S3-127",
  tieneArchivo: true,                 tieneArchivo: true,
  mimeType: "application/pdf"         mimeType: "application/pdf"
}
```

---

## 6. Interfaz de Usuario

### 6.1 Página de Búsqueda (`/ciudadano`)

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 Consulta de Procesos Judiciales                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tipo de búsqueda: [N° Proceso ▼] [Actor/Ofendido] [Demandado] │
│                                                                 │
│  ┌─────────────────────────────────────────────┐ ┌───────────┐ │
│  │ Ingrese el número de proceso...             │ │  Buscar   │ │
│  └─────────────────────────────────────────────┘ └───────────┘ │
│                                                                 │
│  Formato: PPCCC-AAAA-NNNNN (ej: 17332-2024-00123)              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Resultados                                                     │
├─────────────────────────────────────────────────────────────────┤
│  N° Expediente    | Fecha    | Dependencia | Materia | Estado  │
│  17332-2024-00001 | 15/1/24  | UJ Civil    | Civil   | INICIADA│
│                                                      [Ver ▶]   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Detalle del Proceso (`/ciudadano/proceso/:numeroProceso`)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Expediente 17332-2024-00001                                  │
│    Vista pública del expediente judicial                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────┐  ┌─────────────────────────┐  │
│  │ 📄 Información del Proceso  │  │ 🛡️ Actores Anonimizados │  │
│  │                             │  │                         │  │
│  │ 📅 Fecha: 15/1/2024         │  │ 👤 Actor: Actor Anónimo │  │
│  │ 🏛️ Dependencia: UJ Civil   │  │ 👤 Demandado: Dem. Anón.│  │
│  │ ⚖️ Materia: Civil          │  │ ⚖️ Juez: J5-442        │  │
│  │ 📋 Tipo: Ordinario          │  │                         │  │
│  │ 🕐 Estado: INICIADA         │  │ ℹ️ Los identificadores  │  │
│  │                             │  │ protegen la identidad   │  │
│  └─────────────────────────────┘  └─────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 📄 Actuaciones Procesales                                   ││
│  │                                                             ││
│  │  ● [Demanda] 15/1/2024 - S3-127                            ││
│  │    Demanda Inicial.pdf                                      ││
│  │    [👁️ Ver documento] [⬇️ Descargar]                       ││
│  │                                                             ││
│  │  ● [Auto] 20/1/2024 - J5-442                               ││
│  │    Auto de Calificación.pdf                                 ││
│  │    [👁️ Ver documento] [⬇️ Descargar]                       ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Archivos Implementados/Modificados

### Backend

| Archivo | Tipo | Descripción |
| ------- | ---- | ----------- |
| `src/routes/publico.routes.ts` | Modificado | Endpoints públicos con seguridad |
| `src/middleware/publicRateLimiter.ts` | Nuevo | Rate limiting + delay progresivo |
| `src/middleware/validateCausa.ts` | Nuevo | Validación de formato de proceso |
| `src/services/causas.service.ts` | Modificado | `getActuacionesPublicas()`, búsqueda por tipo |
| `src/types/index.ts` | Modificado | Tipos `ActuacionPublica` con archivo |

### Frontend

| Archivo | Tipo | Descripción |
| ------- | ---- | ----------- |
| `src/pages/ciudadano/ProcesoDetalle.tsx` | Modificado | Vista con descarga de documentos |
| `src/pages/ciudadano/ConsultaCiudadana.tsx` | Existente | Búsqueda principal |
| `src/services/consulta-ciudadana.service.ts` | Modificado | Transformadores + descarga |
| `src/components/search/ResultsTable.tsx` | Modificado | Estados normalizados |
| `src/types/index.ts` | Modificado | Tipos con campos de archivo |
| `src/App.tsx` | Modificado | Rutas con `numeroProceso` |

---

## 8. Pruebas Realizadas

### 8.1 Pruebas Funcionales

| Caso de Prueba | Resultado |
| -------------- | --------- |
| Buscar por número de proceso válido | ✅ Muestra resultado |
| Buscar por número de proceso inválido | ✅ Error de formato |
| Buscar proceso inexistente | ✅ "Proceso no encontrado" |
| Buscar por actor existente | ✅ Lista resultados |
| Buscar por demandado existente | ✅ Lista resultados |
| Ver detalle de proceso | ✅ Información completa |
| Ver actuaciones | ✅ Timeline con documentos |
| Ver documento PDF | ✅ Abre en nueva pestaña |
| Descargar documento | ✅ Descarga archivo |

### 8.2 Pruebas de Seguridad

| Caso de Prueba | Resultado |
| -------------- | --------- |
| Rate limiting (>15 req/min) | ✅ Bloquea con mensaje |
| Delay progresivo tras fallos | ✅ Incrementa delays |
| SQL Injection en búsqueda | ✅ Sanitizado por parámetros |
| ID de documento malicioso | ✅ Validación regex |
| Acceso sin autenticación | ✅ Funciona (público) |
| Registro en audit log | ✅ Todas las acciones registradas |

---

## 9. Cumplimiento Common Criteria

| Requisito | Implementación | Estado |
| --------- | -------------- | ------ |
| **FDP_IFF.1** | Datos anonimizados (pseudónimos) | ✅ |
| **FIA_AFL.1** | Rate limiting + delay progresivo | ✅ |
| **FAU_GEN.1** | Registro de accesos públicos | ✅ |
| **FDP_ACC.1** | Acceso solo a datos públicos | ✅ |
| **FIA_UAU.1** | Sin autenticación requerida | ✅ |

---

## 10. Notas de Implementación

### 10.1 Decisiones de Diseño

1. **Rate Limiting de 15 req/min**: Balanceo entre usabilidad y protección contra scraping
2. **Delay Progresivo**: Alternativa a CAPTCHA para prevenir abuso automatizado
3. **Validación Regex**: Previene consultas innecesarias a la base de datos
4. **Pseudónimos**: Cumple con protección de datos personales
5. **Sin autenticación**: Acceso público conforme a transparencia judicial

### 10.2 Limitaciones Conocidas

- Los documentos confidenciales no son accesibles públicamente
- El rate limiting es por IP (puede afectar redes compartidas)
- Los pseudónimos son consistentes pero no reversibles públicamente

### 10.3 Mejoras Futuras

- [ ] Implementar CAPTCHA opcional tras múltiples bloqueos
- [ ] Agregar búsqueda por fecha
- [ ] Notificaciones por email de nuevas actuaciones
- [ ] Verificación de identidad para datos sensibles

---

## 11. Referencias

- **Common Criteria**: ISO/IEC 15408
- **LOTAIP**: Ley Orgánica de Transparencia y Acceso a la Información Pública
- **COFJ**: Código Orgánico de la Función Judicial
- **LOPDP**: Ley Orgánica de Protección de Datos Personales

---

*Documento generado: Enero 2026*  
*Versión: 1.0*  
*Sprint: 4*
