# HU-JZ-002: Consulta de Agenda de Jueces

## 📋 Información General

| Campo | Valor |
|-------|-------|
| **ID** | HU-JZ-002 |
| **Nombre** | Consulta de Agenda con Indicadores de Reprogramación |
| **Módulo** | Agenda Judicial |
| **Sprint** | Sprint 2 |
| **Estado** | ✅ Implementado |
| **Prioridad** | 🟠 ALTA |
| **Fecha Implementación** | 2026-01-06 |

## 🎯 Objetivo

Permitir a los **Jueces** consultar su agenda de audiencias de manera eficiente, con **indicadores visuales de reprogramación** que les permitan identificar rápidamente qué audiencias han sido modificadas y cuántas veces.

## 📖 Historia de Usuario

**Como** Juez  
**Quiero** ver mi agenda de audiencias con indicadores de cambios  
**Para** estar informado de las reprogramaciones y planificar mi tiempo efectivamente

## 🔐 Requisitos de Seguridad

### 1. Control de Acceso (FDP_ACC)

#### Restricciones por Rol

| Rol | Acceso a Agenda | Alcance |
|-----|-----------------|---------|
| **JUEZ** | ✅ | Solo audiencias de causas asignadas a él |
| **SECRETARIO** | ✅ | Solo audiencias de causas que él creó |
| **ADMIN_CJ** | ✅ | Todas las audiencias del sistema |

#### Validación de Acceso
```typescript
// Filtrar según rol
if (req.user?.rol === "JUEZ") {
  filtros.juezId = String(req.user.funcionarioId);
} else if (req.user?.rol === "SECRETARIO") {
  filtros.secretarioCreadorId = String(req.user.funcionarioId);
}
// ADMIN_CJ ve todas
```

### 2. Integridad de Datos (FDP_ITC)

- ✅ Las audiencias mostradas corresponden exclusivamente a las causas asignadas
- ✅ El historial de reprogramaciones es de solo lectura
- ✅ No se puede modificar la información desde la vista de agenda

### 3. Auditoría de Consultas (FAU_GEN)

Cada consulta de agenda genera un log de auditoría:

```typescript
await auditService.logCRUD(
  "audiencia", 
  "consultar", 
  req.user!.funcionarioId, 
  null, 
  {
    filtros: { causaId, estado },
    totalResultados: resultado.total,
  },
  getClientIp(req),
  getUserAgent(req),
  req.user!.correo
);
```

## 🔄 Vistas de Agenda

### Vista 1: Audiencias de Hoy

Muestra las audiencias programadas para el día actual.

**Endpoint**: `GET /api/audiencias/hoy`

**Filtros aplicados**:
- Fecha: `fecha_hora_programada >= hoy 00:00` AND `< mañana 00:00`
- Juez: Solo audiencias de causas asignadas al juez autenticado

### Vista 2: Audiencias de la Semana

Muestra las audiencias de los próximos 7 días.

**Endpoint**: `GET /api/audiencias/semana`

**Filtros aplicados**:
- Fecha: `fecha_hora_programada >= hoy` AND `< hoy + 7 días`
- Ordenamiento: Por fecha ascendente

### Vista 3: Agenda Completa

Muestra todas las audiencias con filtros personalizables.

**Endpoint**: `GET /api/audiencias`

**Parámetros opcionales**:
- `causaId`: Filtrar por causa específica
- `estado`: PROGRAMADA, REPROGRAMADA, REALIZADA, CANCELADA
- `page`, `pageSize`: Paginación

## 📊 Indicadores de Reprogramación

### Información Mostrada

Para cada audiencia, el juez puede ver:

| Indicador | Descripción | Visual |
|-----------|-------------|--------|
| **Estado** | PROGRAMADA / REPROGRAMADA | Badge de color |
| **Veces reprogramada** | Contador de cambios | Badge numérico |
| **Última modificación** | Fecha del último cambio | Texto sutil |
| **Historial completo** | Todos los cambios realizados | Modal expandible |

### Implementación Visual

```tsx
// Indicador de estado en la tarjeta de audiencia
<Badge 
  variant={audiencia.estado === "REPROGRAMADA" ? "warning" : "default"}
>
  {audiencia.estado}
</Badge>

{/* Contador de reprogramaciones */}
{audiencia.vecesProgramada > 1 && (
  <Badge variant="outline" className="text-orange-600">
    <RefreshCw className="w-3 h-3 mr-1" />
    {audiencia.vecesProgramada - 1}x reprogramada
  </Badge>
)}
```

### Historial Expandible

Al hacer clic en una audiencia reprogramada, el juez puede ver:

```tsx
<Dialog>
  <DialogContent>
    <DialogTitle>Historial de Reprogramaciones</DialogTitle>
    
    {historial.map((cambio) => (
      <Card key={cambio.historialId}>
        <CardContent>
          <p><strong>Fecha anterior:</strong> {cambio.fechaHoraAnterior}</p>
          <p><strong>Nueva fecha:</strong> {cambio.fechaHoraNueva}</p>
          <p><strong>Motivo:</strong> {cambio.motivoReprogramacion}</p>
          <p className="text-sm text-muted">
            Modificado el {cambio.fechaModificacion} por {cambio.modificadoPorRol}
          </p>
        </CardContent>
      </Card>
    ))}
  </DialogContent>
</Dialog>
```

## 📡 API Endpoints

### GET /api/audiencias
Obtiene audiencias con filtros y paginación.

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Query Parameters**:
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `causaId` | number | Filtrar por causa |
| `estado` | string | PROGRAMADA, REPROGRAMADA, etc. |
| `page` | number | Página (default: 1) |
| `pageSize` | number | Items por página (default: 10) |

**Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "causaId": 9,
      "tipo": "INICIAL",
      "fechaHora": "2026-01-08T13:00:00.000Z",
      "sala": "Sala 2B",
      "modalidad": "PRESENCIAL",
      "estado": "REPROGRAMADA",
      "vecesProgramada": 2,
      "causa": {
        "numeroProcesoCompleto": "17294-2024-00155",
        "materia": "CIVIL"
      },
      "fechaCreacion": "2026-01-06T04:27:16.000Z"
    }
  ],
  "total": 5
}
```

### GET /api/audiencias/hoy
Obtiene las audiencias del día actual.

**Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "tipo": "CONTINUACION",
      "fechaHora": "2026-01-06T15:00:00.000Z",
      "sala": "Sala 1A",
      "estado": "PROGRAMADA",
      "causa": {
        "numeroProcesoCompleto": "17294-2024-00123"
      }
    }
  ],
  "total": 1
}
```

### GET /api/audiencias/semana
Obtiene las audiencias de los próximos 7 días.

### GET /api/audiencias/:id/historial
Obtiene el historial de reprogramaciones de una audiencia.

**Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "historialId": 9,
      "fechaHoraAnterior": "2026-01-07T12:00:00.000Z",
      "fechaHoraNueva": "2026-01-08T13:00:00.000Z",
      "motivoReprogramacion": "Cambio solicitado por las partes",
      "modificadoPorRol": "SECRETARIO",
      "fechaModificacion": "2026-01-06T04:28:30.000Z"
    }
  ]
}
```

## 💻 Implementación Frontend

### Página de Audiencias

```tsx
// AudienciasPage.tsx
export function AudienciasPage() {
  const [audiencias, setAudiencias] = useState<AudienciaConHistorial[]>([]);
  const [filtroVista, setFiltroVista] = useState<"hoy" | "semana" | "todas">("todas");
  
  useEffect(() => {
    cargarAudiencias();
  }, [filtroVista]);
  
  const cargarAudiencias = async () => {
    let data;
    switch (filtroVista) {
      case "hoy":
        data = await audienciasService.getAudienciasHoy();
        break;
      case "semana":
        data = await audienciasService.getAudienciasSemana();
        break;
      default:
        data = await audienciasService.getAudiencias();
    }
    setAudiencias(data);
  };
  
  return (
    <FuncionariosLayout>
      {/* Tabs para filtrar por período */}
      <Tabs value={filtroVista} onValueChange={setFiltroVista}>
        <TabsList>
          <TabsTrigger value="hoy">Hoy</TabsTrigger>
          <TabsTrigger value="semana">Esta Semana</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Lista de audiencias con indicadores */}
      <div className="grid gap-4">
        {audiencias.map((audiencia) => (
          <AudienciaCard 
            key={audiencia.id} 
            audiencia={audiencia}
            showHistorial={audiencia.estado === "REPROGRAMADA"}
          />
        ))}
      </div>
    </FuncionariosLayout>
  );
}
```

### Tarjeta de Audiencia con Indicadores

```tsx
// AudienciaCard.tsx
function AudienciaCard({ audiencia, showHistorial }) {
  const [historialAbierto, setHistorialAbierto] = useState(false);
  
  return (
    <Card className={audiencia.estado === "REPROGRAMADA" ? "border-orange-300" : ""}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Audiencia {audiencia.tipo}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {audiencia.causa?.numeroProcesoCompleto}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Badge variant={getEstadoVariant(audiencia.estado)}>
              {audiencia.estado}
            </Badge>
            
            {audiencia.vecesProgramada > 1 && (
              <Badge 
                variant="outline" 
                className="text-orange-600 cursor-pointer"
                onClick={() => setHistorialAbierto(true)}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {audiencia.vecesProgramada - 1}x
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {format(new Date(audiencia.fechaHora), "dd/MM/yyyy")}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {format(new Date(audiencia.fechaHora), "HH:mm")}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {audiencia.sala}
          </span>
        </div>
      </CardContent>
      
      {/* Modal de historial */}
      <HistorialReprogramacionesModal 
        open={historialAbierto}
        onClose={() => setHistorialAbierto(false)}
        audienciaId={audiencia.id}
      />
    </Card>
  );
}
```

## 🗃️ Consultas SQL Optimizadas

### Obtener Audiencias con Conteo de Reprogramaciones

```sql
SELECT 
  a.*,
  c.numero_proceso_completo,
  c.materia,
  (
    SELECT COUNT(*) + 1 
    FROM audiencias_historial_reprogramaciones h 
    WHERE h.audiencia_id = a.audiencia_id
  ) as veces_programada
FROM audiencias a
JOIN causas c ON a.causa_id = c.causa_id
WHERE c.juez_asignado_id = $1  -- ID del juez autenticado
ORDER BY a.fecha_hora_programada ASC;
```

### Obtener Historial de Reprogramaciones

```sql
SELECT 
  h.*,
  a.tipo as tipo_audiencia
FROM audiencias_historial_reprogramaciones h
JOIN audiencias a ON h.audiencia_id = a.audiencia_id
WHERE h.audiencia_id = $1
ORDER BY h.fecha_modificacion DESC;
```

## ✅ Criterios de Aceptación

| # | Criterio | Estado |
|---|----------|--------|
| 1 | Juez solo ve audiencias de sus causas | ✅ |
| 2 | Vista de audiencias del día actual | ✅ |
| 3 | Vista de audiencias de la semana | ✅ |
| 4 | Indicador visual para audiencias reprogramadas | ✅ |
| 5 | Contador de veces reprogramada visible | ✅ |
| 6 | Acceso al historial completo de cambios | ✅ |
| 7 | Información del motivo de reprogramación | ✅ |
| 8 | Consultas generan logs de auditoría | ✅ |
| 9 | Ordenamiento por fecha de audiencia | ✅ |
| 10 | Paginación para listas largas | ✅ |

## 🧪 Casos de Prueba

### Caso 1: Juez consulta sus audiencias
```
Precondición: Juez autenticado con causas asignadas
Acción: GET /api/audiencias
Resultado: Solo ve audiencias de causas donde es el juez asignado
```

### Caso 2: Juez intenta ver audiencia de otro juez
```
Precondición: Juez A intenta acceder a audiencia de Juez B
Acción: GET /api/audiencias/:id (audiencia de otro juez)
Resultado: 403 Forbidden o lista vacía (según endpoint)
```

### Caso 3: Ver indicador de reprogramación
```
Precondición: Audiencia reprogramada 2 veces
Acción: GET /api/audiencias
Resultado: vecesProgramada = 3, estado = "REPROGRAMADA"
```

### Caso 4: Acceder al historial
```
Precondición: Audiencia con historial de cambios
Acción: GET /api/audiencias/:id/historial
Resultado: Lista de todos los cambios con fechas y motivos
```

## 📁 Archivos Implementados

### Backend
- `backend/src/routes/audiencias.routes.ts`
  - GET `/` - Listar audiencias (con auditoría)
  - GET `/hoy` - Audiencias del día
  - GET `/semana` - Audiencias de la semana
  - GET `/:id/historial` - Historial de reprogramaciones

- `backend/src/services/audiencias.service.ts`
  - `getAudiencias()` - Con filtros por rol
  - `getAudienciasHoy()` - Filtro por fecha actual
  - `getAudienciasSemana()` - Filtro por 7 días
  - `getHistorialReprogramaciones()` - Obtener cambios
  - `getAgendaJuez()` - Agenda específica del juez

### Frontend
- `frontend/src/pages/funcionarios/AudienciasPage.tsx` - Página principal
- `frontend/src/services/audiencias.service.ts` - Cliente API

## 🔗 Dependencias

- **HU-SJ-001**: Registro de causas (causa con juez asignado)
- **HU-SJ-003**: Gestión de audiencias (datos de audiencias)
- **HU-JZ-001**: Control de acceso (verificación de asignación)

## 📊 Métricas de Seguridad

| Métrica | Valor |
|---------|-------|
| Endpoints protegidos | 100% |
| Filtrado por rol | Automático |
| Auditoría de consultas | ✅ Implementada |
| Datos sensibles expuestos | Ninguno |
| Información de otros jueces | Inaccesible |

## 🔔 Notificaciones Integradas

El juez recibe notificaciones automáticas cuando:

| Evento | Notificación |
|--------|--------------|
| Nueva audiencia | "Se ha programado una nueva audiencia para la causa X" |
| Reprogramación | "La audiencia del día X ha sido reprogramada al día Y" |
| Cancelación | "La audiencia del día X ha sido cancelada" |

Las notificaciones aparecen en el panel de notificaciones del juez y se pueden marcar como leídas.

## 📈 Mejoras Futuras

1. **Sincronización con calendario externo** (Google Calendar, Outlook)
2. **Exportación a PDF** de la agenda semanal
3. **Filtros avanzados** por materia, tipo de audiencia
4. **Vista de calendario visual** con drag & drop
5. **Recordatorios automáticos** antes de las audiencias
