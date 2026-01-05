# Schema de Base de Datos de Casos

## Última Actualización: 2026-01-05

Este directorio contiene los scripts SQL para la base de datos de casos del sistema Juez Seguro.

## ⚠️ IMPORTANTE: Schema Actualizado

El schema ha sido actualizado para ser **100% consistente** con los tipos TypeScript definidos en `backend/src/types/index.ts`.

### Cambios Principales

1. **ID numérico en lugar de UUID**: Se usa `causa_id SERIAL` en lugar de `id UUID`
2. **Nombres de columnas snake_case**: Coinciden exactamente con los tipos del backend
3. **Campos de partes procesales**: Incluye `actor_nombre`, `actor_identificacion`, `demandado_nombre`, `demandado_identificacion`
4. **Pseudónimos para funcionarios**: `juez_pseudonimo`, `secretario_pseudonimo`
5. **Estados simplificados**: Estados consistentes con el enum del backend

## Estructura de Archivos

- `00_reset_schema.sql` - Limpia el schema existente ⚠️ **BORRA DATOS**
- `01_schema.sql` - **Schema principal actualizado** (usar este)
- `01_schema_OLD.sql` - Schema antiguo (respaldo, no usar)
- `02_seed_catalogos.sql` - Datos de catálogos
- `03_seed_pseudonimos_dev.sql` - Pseudónimos de desarrollo
- `04_documentos.sql` - Schema complementario de documentos
- `05_add_partes_procesales.sql` - ~~Migración temporal~~ (ya no necesaria con nuevo schema)

## Tablas Principales

### causas
Tabla principal de causas judiciales con:
- IDs numéricos (`causa_id`)
- Nombres reales de partes procesales (información pública)
- Pseudónimos de funcionarios judiciales (protección de identidad)

### mapa_pseudonimos
Mapeo entre IDs reales de jueces y pseudónimos públicos (FDP_IFF)

### expedientes
Expedientes electrónicos asociados a causas

### documentos
Metadatos de documentos del expediente

### audiencias
Programación y registro de audiencias

## Orden de Ejecución (Setup Inicial)

```bash
# 1. Reset (OPCIONAL - solo si necesitas empezar desde cero)
psql -h localhost -p 5433 -U admin_cases -d db_casos -f 00_reset_schema.sql

# 2. Crear schema
psql -h localhost -p 5433 -U admin_cases -d db_casos -f 01_schema.sql

# 3. Cargar catálogos (si aplica)
psql -h localhost -p 5433 -U admin_cases -d db_casos -f 02_seed_catalogos.sql

# 4. Datos de desarrollo (si aplica)
psql -h localhost -p 5433 -U admin_cases -d db_casos -f 03_seed_pseudonimos_dev.sql
```

## Consistencia con el Backend

El schema actual está 100% alineado con:

```typescript
// backend/src/types/index.ts
export interface Causa {
  causa_id: number;              // ✅ SERIAL PRIMARY KEY
  numero_proceso: string;        // ✅ VARCHAR(50) UNIQUE
  materia: string;               // ✅ VARCHAR(100)
  tipo_proceso: string;          // ✅ VARCHAR(100)
  unidad_judicial: string;       // ✅ VARCHAR(200)
  juez_asignado_id: number;      // ✅ INTEGER
  juez_pseudonimo: string;       // ✅ VARCHAR(50)
  secretario_creador_id: number; // ✅ INTEGER
  secretario_pseudonimo?: string;// ✅ VARCHAR(50)
  estado_procesal: EstadoProcesal;// ✅ VARCHAR(30)
  fecha_creacion: Date;          // ✅ TIMESTAMPTZ
  descripcion?: string;          // ✅ TEXT
  actor_nombre?: string;         // ✅ VARCHAR(255)
  demandado_nombre?: string;     // ✅ VARCHAR(255)
}
```

## Protección de Datos (FDP)

El schema implementa:

- **FDP_IFF**: Pseudonimización de funcionarios judiciales
- **Información Pública**: Nombres reales de partes procesales (no se pseudonimizan)
- **Separación de BD**: Funcionarios en `db_usuarios`, casos en `db_casos`
- **Referencias seguras**: Solo IDs numéricos, no datos personales sensibles

## Notas

- Los nombres de actores y demandados NO se pseudonimizan porque son información pública del proceso judicial
- Los nombres de jueces y secretarios SÍ se pseudonimizan para proteger su identidad
- El mapeo real entre IDs y pseudónimos está en la tabla `mapa_pseudonimos` con acceso restringido
