# Sprint 3: Integridad, Firma Electrónica y Control de Plazos

## Objetivo
Implementar la firma electrónica de sentencias (garantizando el no repudio) y el control de plazos procesales (trazabilidad temporal).

## Historias de Usuario

### HU-JZ-003: Elaboración y firma de autos, providencias y sentencias
- **Actor**: Juez
- **Objetivo**: Firmar documentos judiciales con validez legal
- **Flujo de estados**: `BORRADOR` → `LISTA_PARA_FIRMA` → `FIRMADA`

### HU-SJ-004: Notificaciones procesales y control de plazos judiciales
- **Actor**: Secretario Judicial
- **Objetivo**: Registrar notificaciones y controlar plazos legales

---

## Estructura de Archivos Sprint 3

```
Juez-Seguro/
├── setup_pki.sh              # Script PKI para Linux/Mac
├── setup_pki.ps1             # Script PKI para Windows
├── certs/                    # Infraestructura PKI (generada)
│   ├── ca/
│   │   ├── ca.key            # Clave privada CA (PROTEGER)
│   │   └── ca.crt            # Certificado público CA
│   ├── jueces/
│   │   ├── juez_10.*         # Certificados Juan Pérez
│   │   ├── juez_11.*         # Certificados María García
│   │   └── juez_12.*         # Certificados Carlos López
│   ├── anonymization.salt    # Salt para anonimización
│   ├── jwt_secret.key        # Secreto JWT
│   └── docs_encryption.key   # Clave AES-256
├── scripts/
│   └── casos_sprint3/
│       └── 01_init_sprint3.sql  # Esquema de BD
└── docker-compose.yml        # Actualizado con PKI
```

---

## Instrucciones de Configuración

### 1. Generar Infraestructura PKI

**Windows (PowerShell):**
```powershell
# Desde la raíz del proyecto
.\setup_pki.ps1
```

**Linux/Mac (Bash):**
```bash
chmod +x setup_pki.sh
./setup_pki.sh
```

### 2. Ejecutar Script de Base de Datos

Conectarse a `db_casos` y ejecutar:
```sql
\i scripts/casos_sprint3/01_init_sprint3.sql
```

O usando Docker:
```bash
docker exec -i juez_seguro_db_cases psql -U admin_cases -d db_casos < scripts/casos_sprint3/01_init_sprint3.sql
```

### 3. Reiniciar Contenedores
```bash
docker-compose down
docker-compose up -d
```

---

## Tablas de Base de Datos

### `decisiones_judiciales`
Almacena autos, providencias y sentencias con:
- Estado inmutable post-firma (trigger de seguridad)
- Hash SHA-256 del PDF firmado
- Metadatos de certificado digital

### `notificaciones_procesales`
Notificaciones legales a las partes con:
- Timestamps confiables (del servidor)
- Tracking de envío y recepción
- Hash de integridad del contenido

### `plazos_procesales`
Control de plazos judiciales con:
- Cálculo automático de días hábiles
- Alertas configurables
- Estados de cumplimiento

### `catalogo_tipos_actuacion`
Catálogo de actuaciones con plazos legales predefinidos.

### `dias_inhabiles`
Feriados y días no laborables para cálculo de plazos.

---

## Seguridad Implementada

| Requisito | Implementación |
|-----------|----------------|
| **Inmutabilidad** | Trigger `bloquear_modificacion_firmados()` |
| **No repudio** | Firma RSA con certificado del juez |
| **Integridad** | Hash SHA-256 de documentos firmados |
| **FIA_ATD.1** | Validación de atributos del firmante |
| **FIA_USB.1** | Vinculación firma-sesión autenticada |
| **Trazabilidad** | Historial de versiones y auditoría |

---

## Consideraciones de Producción

⚠️ **IMPORTANTE para despliegue en producción:**

1. **Claves privadas**: Nunca commitear a Git
2. **Passwords PFX**: Usar Docker Secrets o HashiCorp Vault
3. **Certificados**: Obtener de CA real (no autofirmados)
4. **Volumen WORM**: Configurar permisos de solo lectura post-escritura
5. **Backups**: Implementar backup cifrado de claves

---

## Próximos Pasos

1. ✅ Fase de Infraestructura PKI
2. ⏳ Implementar servicios de firma en backend
3. ⏳ Crear endpoints REST para decisiones
4. ⏳ Implementar cálculo de plazos
5. ⏳ Crear componentes frontend
