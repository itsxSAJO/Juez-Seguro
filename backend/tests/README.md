# Pruebas de Seguridad HU-JZ-001

Scripts automatizados para validar el control de acceso basado en propiedad (FIA_ATD.1).

## 📋 Scripts Disponibles

### 1. `test-hu-jz-001-security.ts`
Script TypeScript completo con axios para pruebas exhaustivas.

### 2. `test-hu-jz-001-security.ps1`
Script PowerShell con Invoke-RestMethod para Windows.

## 🚀 Ejecutar Pruebas

### Opción 1: TypeScript (Recomendado)

```bash
# Instalar dependencias
cd backend
npm install axios --save-dev
npm install @types/node --save-dev

# Ejecutar pruebas
npx tsx tests/test-hu-jz-001-security.ts
```

### Opción 2: PowerShell

```powershell
# Desde el directorio backend
cd backend
.\tests\test-hu-jz-001-security.ps1
```

## ⚙️ Configuración

Antes de ejecutar las pruebas, asegúrate de:

### 1. Backend en Ejecución
```bash
cd backend
npm run dev
```

El backend debe estar corriendo en `http://localhost:3000`

### 2. Base de Datos Poblada

Verifica que existen usuarios de prueba:

```sql
-- En db_usuarios
SELECT * FROM funcionarios WHERE correo_institucional IN (
  'juez1@judicial.gob.ec',
  'juez2@judicial.gob.ec',
  'admin@judicial.gob.ec'
);

-- En db_casos
SELECT * FROM causas LIMIT 5;
```

### 3. Ajustar IDs de Prueba

En el script TypeScript, actualiza estas variables con IDs reales de tu BD:

```typescript
const TEST_DATA = {
  causa_juez1: 1,      // ID de causa asignada al juez1
  causa_juez2: 2,      // ID de causa asignada al juez2
  documento_juez1: '', // ID de documento
  documento_juez2: '', // ID de documento
  audiencia_juez1: 0,  // ID de audiencia
  audiencia_juez2: 0,  // ID de audiencia
};
```

En el script PowerShell:

```powershell
$CAUSA_JUEZ1 = 1
$CAUSA_JUEZ2 = 2
$DOCUMENTO_JUEZ1 = "doc-001"
$AUDIENCIA_JUEZ1 = 1
```

### 4. Credenciales de Usuarios

Actualiza las credenciales si difieren:

```typescript
const CREDENTIALS = {
  juez1: {
    correo: 'juez1@judicial.gob.ec',
    password: 'Password123!',
  },
  juez2: {
    correo: 'juez2@judicial.gob.ec',
    password: 'Password123!',
  },
  admin: {
    correo: 'admin@judicial.gob.ec',
    password: 'AdminPass123!',
  },
};
```

## 📊 Pruebas Ejecutadas

### 1. Control de Acceso a Causas (FIA_ATD.1)
- ✅ Acceso autorizado a causa propia
- ✅ Acceso denegado a causa ajena (IDOR)
- ✅ Bypass de administrador

### 2. Control de Acceso a Expedientes
- ✅ Acceso a expediente propio
- ✅ Denegación de expediente ajeno

### 3. Control de Acceso a Documentos
- ✅ Acceso a documento propio
- ✅ Denegación de documento ajeno
- ✅ Acceso a documentos por causa

### 4. Control de Acceso a Audiencias
- ✅ Modificación de audiencia propia
- ✅ Denegación de modificación ajena

### 5. Auditoría (FAU_GEN.1)
- ✅ Logs de acceso denegado
- ✅ Logs de acceso permitido
- ✅ Hash de integridad en logs

## 📈 Resultados Esperados

### Acceso Autorizado
```
✅ Acceso permitido a causa 1
ℹ️  Número de proceso: 17281-2026-00001
ℹ️  Estado: EN_TRAMITE
```

### Acceso Denegado (IDOR)
```
✅ Acceso denegado correctamente (403 Forbidden)
✅ Código: FORBIDDEN_RESOURCE
✅ Mensaje: No tiene autorización para acceder a esta causa
ℹ️  ✓ Debe existir log en db_logs con severidad ALTA
```

### Logs en Backend Console
```
[SEGURIDAD] ACCESO_DENEGADO - Posible IDOR: 
Juez 42 (juez.perez@judicial.gob.ec) intentó acceder a causa 123 
desde IP 192.168.1.100
```

## 🔍 Verificación de Logs

Después de ejecutar las pruebas, verifica los logs en PostgreSQL:

```sql
-- Últimos accesos denegados
SELECT 
  log_id,
  fecha_evento,
  tipo_evento,
  usuario_correo,
  descripcion_evento,
  datos_afectados
FROM logs_auditoria
WHERE tipo_evento = 'ACCESO_DENEGADO'
  AND modulo_afectado = 'CASOS'
ORDER BY fecha_evento DESC
LIMIT 10;

-- Estadísticas de IDOR
SELECT 
  usuario_correo,
  COUNT(*) as intentos_idor
FROM logs_auditoria
WHERE tipo_evento = 'ACCESO_DENEGADO'
  AND fecha_evento >= NOW() - INTERVAL '1 hour'
GROUP BY usuario_correo;
```

## 🐛 Troubleshooting

### Error: "No se pudieron obtener tokens"
- Verifica que el backend esté corriendo
- Confirma que las credenciales sean correctas
- Verifica que los usuarios existan en db_usuarios

### Error: "404 Not Found"
- Los IDs en TEST_DATA no existen en la base de datos
- Actualiza con IDs reales

### Error: "403 Forbidden en acceso autorizado"
- El juez no tiene la causa asignada
- Verifica juez_asignado_id en la tabla causas

### No se generan logs
- Verifica conexión a db_logs
- Revisa que auditService esté funcionando
- Consulta la consola del backend para errores

## 📚 Referencias

- [HU-JZ-001 Documentación Completa](../../docs/HU-JZ-001-Control-Acceso-Jueces-COMPLETO.md)
- [Middleware de Control de Acceso](../src/middleware/access-control.middleware.ts)
- [Common Criteria FIA_ATD.1](https://www.commoncriteriaportal.org/)

## 🎯 Checklist Pre-Ejecución

- [ ] Backend corriendo en http://localhost:3000
- [ ] Bases de datos (db_usuarios, db_casos, db_logs) activas
- [ ] Usuarios de prueba creados
- [ ] Causas asignadas a jueces diferentes
- [ ] IDs actualizados en TEST_DATA
- [ ] Credenciales actualizadas en CREDENTIALS

## ✅ Criterios de Éxito

Las pruebas son exitosas si:

1. ✅ Juez 1 puede acceder a sus propias causas
2. ✅ Juez 1 NO puede acceder a causas del Juez 2 (403)
3. ✅ Admin puede acceder a todas las causas
4. ✅ Cada intento IDOR genera log con severidad ALTA
5. ✅ Alertas aparecen en consola del backend
6. ✅ Logs tienen hash SHA-256 de integridad

---

**Última actualización**: 2026-01-05  
**Sprint**: 2 - Operativa del Expediente y Audiencias
