# HU-SJ-001: Registro de Nuevas Causas

| Campo | Valor |
| ----- | ----- |
| **Historia de Usuario** | HU-SJ-001 |
| **Título** | Registro de Nuevas Causas |
| **Actor** | Secretario Judicial |
| **Sprint** | 2 |

## Descripción

Como secretario judicial, quiero registrar nuevas causas, para iniciar el trámite judicial de las causas.

**Objetivo**: Inicio del proceso judicial con integridad.

## Criterios de Aceptación

1. ✅ El secretario solo puede crear causas de su materia asignada (FIA_ATD)
2. ✅ El secretario solo puede crear causas en su unidad judicial asignada (FIA_ATD)
3. ✅ El sistema asigna automáticamente un juez por sorteo equitativo
4. ✅ Se genera un número de proceso único automáticamente
5. ✅ Se crea el expediente electrónico asociado automáticamente
6. ✅ Se registra el evento en auditoría (FAU_GEN)
7. ✅ El juez se muestra con pseudónimo (FDP_IFF)

---

## Implementación Técnica

### 1. Validación de Permisos (Scope) - FIA_ATD

La validación de scope intercepta la petición y compara los atributos del token del secretario con los datos del formulario.

#### Flujo de Validación

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Secretario    │────▶│  Token de Sesión     │────▶│   Validación    │
│  (Formulario)   │     │  - UnidadJudicial    │     │   de Scope      │
│                 │     │  - Materia           │     │                 │
│  materia: Penal │     │  - funcionarioId     │     │  ¿Coinciden?    │
│  unidad: Quito  │     │                      │     │                 │
└─────────────────┘     └──────────────────────┘     └───────┬─────────┘
                                                             │
                                     ┌───────────────────────┴───────────────────────┐
                                     │                                               │
                                     ▼                                               ▼
                            ┌─────────────────┐                             ┌─────────────────┐
                            │   ✅ Continuar   │                             │  ❌ Error 403   │
                            │   con creación   │                             │  FORBIDDEN      │
                            └─────────────────┘                             └─────────────────┘
```

#### Implementación en Código

```typescript
// backend/src/services/causas.service.ts

validarScope(secretario: TokenPayload, input: CrearCausaInput): ValidacionScopeResult {
  const normalizarString = (str: string): string => 
    str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const secretarioMateria = normalizarString(secretario.materia);
  const causaMateria = normalizarString(input.materia);
  const secretarioUnidad = normalizarString(secretario.unidadJudicial);
  const causaUnidad = normalizarString(input.unidadJudicial);

  // Validar materia
  if (secretarioMateria !== causaMateria) {
    return {
      valido: false,
      error: `No tiene permisos para crear causas de materia "${input.materia}".`,
      codigo: "MATERIA_NO_COINCIDE",
    };
  }

  // Validar unidad judicial
  if (secretarioUnidad !== causaUnidad) {
    return {
      valido: false,
      error: `No tiene permisos para crear causas en la unidad "${input.unidadJudicial}".`,
      codigo: "UNIDAD_NO_COINCIDE",
    };
  }

  return { valido: true };
}
```

**Controles de Seguridad Implementados:**

- ✅ Comparación case-insensitive (normalización Unicode)
- ✅ Registro en auditoría de intentos denegados
- ✅ Código de error específico para frontend

---

### 2. Asignación Automática de Juez (Sorteo Equitativo)

El sistema selecciona automáticamente un juez mediante sorteo, considerando la carga de trabajo para distribución equitativa.

#### Algoritmo de Selección

```
┌─────────────────────────────────────────────────────────────────┐
│                     SORTEO DE JUEZ                               │
├─────────────────────────────────────────────────────────────────┤
│ 1. Filtrar jueces disponibles:                                  │
│    - Mismo materia que la causa                                 │
│    - Misma unidad judicial                                      │
│    - Estado = ACTIVA                                            │
│    - Rol = JUEZ                                                 │
│                                                                 │
│ 2. Calcular carga de trabajo:                                   │
│    - Contar causas activas por juez                            │
│    - (estado NOT IN 'RESUELTA', 'ARCHIVADA')                   │
│                                                                 │
│ 3. Seleccionar candidatos con menor carga                       │
│                                                                 │
│ 4. Sorteo aleatorio entre candidatos                            │
└─────────────────────────────────────────────────────────────────┘
```

#### Implementación en Código

```typescript
// backend/src/services/causas.service.ts

async seleccionarJuez(unidadJudicial: string, materia: string): Promise<JuezDisponible | null> {
  const juecesDisponibles = await this.getJuecesDisponibles(unidadJudicial, materia);

  if (juecesDisponibles.length === 0) {
    return null;
  }

  // Obtener carga de trabajo de cada juez
  const juecesConCarga = await Promise.all(
    juecesDisponibles.map(async (juez) => {
      const cargaResult = await casesClient.query(
        `SELECT COUNT(*) as carga 
         FROM causas 
         WHERE juez_asignado_id = $1 
           AND estado_procesal NOT IN ('RESUELTA', 'ARCHIVADA')`,
        [juez.funcionario_id]
      );
      return { ...juez, carga: parseInt(cargaResult.rows[0].carga, 10) };
    })
  );

  // Ordenar por menor carga y seleccionar aleatoriamente
  juecesConCarga.sort((a, b) => a.carga - b.carga);
  const menorCarga = juecesConCarga[0].carga;
  const juecesConMenorCarga = juecesConCarga.filter(j => j.carga === menorCarga);
  
  const indiceAleatorio = Math.floor(Math.random() * juecesConMenorCarga.length);
  return juecesConMenorCarga[indiceAleatorio];
}
```

**Controles de Seguridad Implementados:**

- ✅ Solo jueces con estado ACTIVA
- ✅ Distribución equitativa de carga
- ✅ Sorteo aleatorio para imparcialidad

---

### 3. Anonimización con Pseudónimos (FDP_IFF)

Los jueces se identifican mediante pseudónimos para proteger su identidad en el portal público.

#### Flujo de Pseudonimización

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Juez Real     │────▶│  mapa_pseudonimos    │────▶│   Portal        │
│  (funcionario)  │     │                      │     │   Público       │
│                 │     │  juez_id_real: 2     │     │                 │
│  ID: 2          │     │  pseudonimo: N5-A7F  │     │  Juez: N5-A7F   │
│  Nombre: María  │     │                      │     │                 │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
```

#### Datos Almacenados en Causa

```sql
-- Tabla causas
INSERT INTO causas (
    numero_proceso,
    juez_asignado_id,    -- ID real (solo visible internamente)
    juez_pseudonimo,     -- Pseudónimo (visible en portal público)
    ...
) VALUES (
    '17281-2026-00001',
    2,                   -- Referencia interna
    'N5-A7F3E1B2',       -- Para ciudadanos
    ...
);
```

**Controles de Seguridad Implementados:**

- ✅ Pseudónimo generado con HMAC-SHA256 (irreversible)
- ✅ juez_asignado_id nunca expuesto en API pública
- ✅ JOINs peligrosos evitados con campo redundante

---

### 4. Creación Automática de Expediente

Al crear una causa, se genera automáticamente el expediente electrónico asociado.

```typescript
// Dentro de transacción
await client.query("BEGIN");

// Insertar causa
const resultCausa = await client.query(
  `INSERT INTO causas (...) VALUES (...) RETURNING *`
);
const causa = resultCausa.rows[0];

// Crear expediente automáticamente
await client.query(
  `INSERT INTO expedientes (causa_id, observaciones)
   VALUES ($1, $2)`,
  [causa.causa_id, `Expediente creado automáticamente. ${descripcion}`]
);

await client.query("COMMIT");
```

---

### 5. Registro de Auditoría (FAU_GEN)

Todos los eventos de creación de causa se registran en `db_logs`.

```typescript
await auditService.log({
  tipoEvento: "CREACION_CAUSA",
  usuarioId: secretario.funcionarioId,
  usuarioCorreo: secretario.correo,
  moduloAfectado: "CASOS",
  descripcion: `Causa ${numeroProceso} creada con asignación automática de juez`,
  datosAfectados: { 
    causaId: causa.causa_id, 
    numeroProceso,
    materia: input.materia,
    unidadJudicial: input.unidadJudicial,
    juezAsignadoId: juezSeleccionado.funcionario_id,
    juezPseudonimo,
    metodoAsignacion: "sorteo_equitativo"
  },
  ipOrigen: ip,
  userAgent,
});
```

**Eventos Auditados:**

| Evento | Descripción |
| ------ | ----------- |
| CREACION_CAUSA | Causa creada exitosamente |
| ACCESO_DENEGADO | Intento de crear causa fuera de scope |

---

## Endpoint API

### POST /api/causas

**Autorización:** Bearer Token (rol: SECRETARIO)

**Request Body:**

```json
{
  "materia": "Civil",
  "tipoProceso": "Ordinario",
  "unidadJudicial": "Unidad Judicial Civil de Quito",
  "descripcion": "Demanda por incumplimiento de contrato...",
  "actorIdentificacion": "1712345678",
  "demandadoIdentificacion": "0912345678"
}
```

**Response 201 (Éxito):**

```json
{
  "success": true,
  "data": {
    "causa_id": 1,
    "numero_proceso": "17281-2026-00001",
    "materia": "Civil",
    "tipo_proceso": "Ordinario",
    "unidad_judicial": "Unidad Judicial Civil de Quito",
    "estado_procesal": "INICIADA",
    "juezPseudonimo": "N5-A7F3E1B2"
  },
  "message": "Causa 17281-2026-00001 creada correctamente. Juez asignado: N5-A7F3E1B2"
}
```

**Response 403 (Scope Inválido):**

```json
{
  "success": false,
  "error": "No tiene permisos para crear causas de materia \"Penal\". Su materia asignada es \"Civil\".",
  "code": "MATERIA_NO_COINCIDE"
}
```

**Response 400 (Sin Jueces):**

```json
{
  "success": false,
  "error": "No hay jueces disponibles para la materia \"Civil\" en la unidad \"Unidad Judicial Civil de Quito\".",
  "code": "NO_JUECES_DISPONIBLES"
}
```

---

## Interfaz de Usuario

### Formulario de Registro (NuevaCausa.tsx)

El formulario muestra automáticamente solo las opciones válidas según el scope del secretario:

```
┌────────────────────────────────────────────────────────────────┐
│  🛡️ Validación de Scope (FIA_ATD)                              │
│  Solo puede registrar causas de Civil en                       │
│  Unidad Judicial Civil de Quito.                               │
│  El juez será asignado automáticamente por sorteo equitativo.  │
└────────────────────────────────────────────────────────────────┘

Paso 1: Datos del Proceso
├── Materia: [Civil] (bloqueado - según perfil)
├── Tipo de Acción: [Ordinario ▼]
└── Unidad Judicial: [Unidad Judicial Civil de Quito] (bloqueado)

Paso 2: Partes Procesales
├── Actor: [Nombre] [Identificación]
└── Demandado: [Nombre] [Identificación]

Paso 3: Descripción
└── Descripción de la demanda: [...]
```

### Diálogo de Éxito

```
┌────────────────────────────────────────────────────────────────┐
│                    ✅ Causa Registrada Exitosamente            │
│                                                                │
│  Número de Proceso:                                            │
│  ┌──────────────────────────────────────┐                      │
│  │       17281-2026-00001               │                      │
│  └──────────────────────────────────────┘                      │
│                                                                │
│  Juez Asignado (Pseudónimo):                                   │
│  ┌──────────────────────────────────────┐                      │
│  │       N5-A7F3E1B2                    │                      │
│  └──────────────────────────────────────┘                      │
│  El pseudónimo protege la identidad del juez (FDP_IFF)         │
│                                                                │
│  [Ver Causas]  [Registrar Otra]                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Archivos Modificados

| Archivo | Descripción |
| ------- | ----------- |
| backend/src/services/causas.service.ts | Lógica de validación de scope, sorteo de juez, creación de causa |
| backend/src/routes/causas.routes.ts | Endpoint POST /api/causas actualizado |
| frontend/src/services/causas.service.ts | Cliente API con manejo de errores de scope |
| frontend/src/pages/funcionarios/NuevaCausa.tsx | Formulario con validación de scope en UI |

---

## Common Criteria - Controles Implementados

| Requisito | Implementación |
| --------- | -------------- |
| FIA_ATD (Atributos de Usuario) | Validación de materia y unidad judicial del token |
| FIA_USB (Binding de Sesión) | Token JWT con atributos de sesión |
| FDP_IFF (Flujo de Información) | Pseudonimización de jueces |
| FDP_PSE (Pseudonimización) | Tabla mapa_pseudonimos con HMAC-SHA256 |
| FAU_GEN (Generación de Auditoría) | Registro de creación y accesos denegados |
