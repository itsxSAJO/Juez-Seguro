# 📚 Arquitectura de Bases de Datos - Juez Seguro

## 🏗️ Visión General

El sistema Juez Seguro utiliza **4 bases de datos PostgreSQL** separadas siguiendo el principio de **segregación de datos** para mayor seguridad:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA DE DATOS                                 │
├──────────────────┬──────────────────┬───────────────────┬───────────────────┤
│   db_usuarios    │    db_casos      │     db_logs       │    db_secrets     │
│   Puerto: 5435   │   Puerto: 5433   │   Puerto: 5434    │   Puerto: 5436    │
├──────────────────┼──────────────────┼───────────────────┼───────────────────┤
│ • funcionarios   │ • causas         │ • logs_auditoria  │ • secretos_sistema│
│ • roles          │ • documentos     │ • audit_sesiones  │ • historial_      │
│ • historial_     │ • decisiones     │ • audit_accesos   │   rotaciones      │
│   estados        │ • audiencias     │ • audit_alertas   │                   │
│ • sesiones_      │ • notificaciones │                   │                   │
│   activas        │ • plazos         │                   │                   │
└──────────────────┴──────────────────┴───────────────────┴───────────────────┘
```

---

## 🔐 Base de Datos: `db_usuarios` (FIA)

**Propósito:** Gestión de identidad y autenticación de funcionarios judiciales.

**Common Criteria:** FIA (Identification and Authentication)

### 🛡️ Cifrado de Datos Sensibles

Los campos `identificacion` y `nombres_completos` están **cifrados con AES-256-GCM** a nivel de aplicación:

| Campo | Tipo | Cifrado | Descripción |
|-------|------|---------|-------------|
| `identificacion` | VARCHAR(500) | ✅ Sí | Cédula del funcionario |
| `nombres_completos` | VARCHAR(500) | ✅ Sí | Nombre completo |
| `correo_institucional` | VARCHAR(255) | ❌ No | Email (usado para login) |

**Algoritmo de Cifrado:**
- **Método:** AES-256-GCM (Galois/Counter Mode)
- **Derivación de clave:** PBKDF2 con 100,000 iteraciones
- **Clave:** `DATA_ENCRYPTION_KEY` (almacenada en db_secrets)
- **Longitud de clave:** 256 bits (32 bytes)

### Tablas

#### `roles`
```sql
- rol_id SERIAL PRIMARY KEY
- nombre VARCHAR(50) UNIQUE NOT NULL -- ADMIN, JUEZ, SECRETARIO
- descripcion TEXT
- fecha_creacion TIMESTAMPTZ
```

#### `funcionarios`
```sql
- funcionario_id SERIAL PRIMARY KEY
- identificacion VARCHAR(500) NOT NULL  -- CIFRADO
- nombres_completos VARCHAR(500) NOT NULL  -- CIFRADO
- correo_institucional VARCHAR(255) UNIQUE
- password_hash VARCHAR(255) NOT NULL  -- bcrypt
- rol_id INTEGER REFERENCES roles
- estado VARCHAR(30) CHECK (ACTIVO, INACTIVO, BLOQUEADO, SUSPENDIDO)
- intentos_fallidos INTEGER (0-10)
- ultimo_acceso TIMESTAMPTZ
```

#### `sesiones_activas`
```sql
- sesion_id SERIAL PRIMARY KEY
- funcionario_id INTEGER REFERENCES funcionarios ON DELETE CASCADE
- token_hash VARCHAR(255) UNIQUE NOT NULL
- ip_address VARCHAR(45)
- expiracion TIMESTAMPTZ
- activa BOOLEAN DEFAULT TRUE
```

#### `historial_estados`
```sql
- historial_id SERIAL PRIMARY KEY
- funcionario_id INTEGER REFERENCES funcionarios
- estado_anterior, estado_nuevo VARCHAR(30)
- motivo TEXT
- fecha_cambio TIMESTAMPTZ
```

---

## ⚖️ Base de Datos: `db_casos` (FDP)

**Propósito:** Gestión de causas judiciales, documentos y decisiones.

**Common Criteria:** FDP (User Data Protection)

### Pseudonimización de Jueces

Los jueces se identifican mediante **pseudónimos** para proteger su identidad:

```
juez_id_real → HMAC-SHA256(salt) → "JUEZ_AB12CD"
```

### Tablas Principales (16 tablas)

#### `causas`
```sql
- causa_id SERIAL PRIMARY KEY
- numero_proceso VARCHAR(50) UNIQUE
- materia, tipo_proceso, unidad_judicial VARCHAR
- juez_asignado_id INTEGER
- juez_pseudonimo VARCHAR(50)  -- "JUEZ_XXXX"
- secretario_creador_id INTEGER
- estado_procesal CHECK (INICIADA, EN_TRAMITE, RESUELTA, ARCHIVADA, SUSPENDIDA)
- actor_nombre, demandado_nombre VARCHAR(255)
```

#### `decisiones_judiciales`
```sql
- decision_id SERIAL PRIMARY KEY
- causa_id INTEGER REFERENCES causas ON DELETE RESTRICT
- juez_autor_id INTEGER
- tipo_decision CHECK (AUTO, PROVIDENCIA, SENTENCIA)
- estado CHECK (BORRADOR, LISTA_PARA_FIRMA, FIRMADA, ANULADA)
- firma_base64 TEXT  -- Firma digital PKCS#7
- hash_integridad_pdf CHAR(64)  -- SHA-256
- certificado_firmante VARCHAR(500)
```

**Triggers de Inmutabilidad:**
- `trg_inmutabilidad_decisiones_update`: Bloquea modificación de decisiones FIRMADAS
- `trg_inmutabilidad_decisiones_delete`: Bloquea eliminación de decisiones FIRMADAS

#### `documentos`
```sql
- id VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()
- causa_id INTEGER REFERENCES causas
- hash_integridad VARCHAR(64)  -- SHA-256
- estado CHECK (activo, eliminado, borrador, pendiente, firmado, notificado)
```

#### `audiencias`
```sql
- audiencia_id SERIAL PRIMARY KEY
- causa_id INTEGER REFERENCES causas
- modalidad CHECK (PRESENCIAL, VIRTUAL, HIBRIDA)
- estado CHECK (programada, realizada, reprogramada, cancelada)
```

**Tablas relacionadas:**
- `audiencias_asistentes`
- `audiencias_historial_reprogramaciones`
- `audiencias_notificaciones`

#### `notificaciones_procesales`
```sql
- notificacion_id SERIAL PRIMARY KEY
- causa_id, decision_id, documento_id
- destinatario_tipo CHECK (actor, demandado, abogado_actor, ...)
- medio CHECK (BUZON_ELECTRONICO, CORREO_ELECTRONICO, FISICO, ...)
- estado CHECK (PENDIENTE, ENVIADA, ENTREGADA, RECIBIDA, LEIDA, FALLIDA)
```

#### `plazos_procesales`
```sql
- plazo_id SERIAL PRIMARY KEY
- causa_id, notificacion_id, decision_id
- tipo_plazo CHECK (contestacion_demanda, interposicion_recurso, ...)
- estado CHECK (VIGENTE, VENCIDO, CUMPLIDO, SUSPENDIDO, CANCELADO)
```

---

## 📋 Base de Datos: `db_logs` (FAU)

**Propósito:** Registro inmutable de eventos de auditoría.

**Common Criteria:** FAU (Security Audit)

### Cadena de Hash (Blockchain-like)

Cada log incluye un hash que referencia al anterior, creando una cadena inmutable:

```
log_1: hash_evento = SHA256(datos), hash_anterior = "GENESIS"
log_2: hash_evento = SHA256(datos), hash_anterior = log_1.hash_evento
log_3: hash_evento = SHA256(datos), hash_anterior = log_2.hash_evento
...
```

### Tablas

#### `logs_auditoria`
```sql
- log_id SERIAL PRIMARY KEY
- fecha_evento TIMESTAMPTZ
- tipo_evento VARCHAR(100)
- usuario_id, usuario_correo, rol_usuario
- ip_origen, endpoint, metodo_http
- hash_evento VARCHAR(64)  -- SHA-256
- hash_anterior VARCHAR(64)  -- Referencia al anterior
```

#### `audit_sesiones`
```sql
- sesion_id VARCHAR(100) UNIQUE
- inicio_sesion, fin_sesion TIMESTAMPTZ
- estado CHECK (ACTIVA, CERRADA, EXPIRADA, REVOCADA)
- total_acciones, acciones_fallidas INTEGER
- hash_registro VARCHAR(64)
```

#### `audit_accesos_datos`
```sql
- usuario_id, tipo_dato, causa_id, documento_id
- operacion VARCHAR(50)  -- lectura, descarga, modificacion
- acceso_permitido BOOLEAN
- hash_registro VARCHAR(64)
```

#### `audit_alertas_seguridad`
```sql
- tipo_alerta VARCHAR(100)
- severidad CHECK (BAJA, MEDIA, ALTA, CRITICA)
- requiere_revision, revisada BOOLEAN
```

---

## 🔑 Base de Datos: `db_secrets` (FCS)

**Propósito:** Almacenamiento seguro de secretos criptográficos.

**Common Criteria:** FCS (Cryptographic Support)

### Arquitectura de Cifrado

```
┌─────────────────────────────────────────────────────────┐
│               MASTER_KEY_PASSWORD                        │
│            (Variable de entorno - NUNCA se guarda)       │
└───────────────────────────┬─────────────────────────────┘
                            │ PBKDF2 (100,000 iteraciones)
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  DERIVED_KEY (256 bits)                  │
│              (En memoria durante ejecución)              │
└───────────────────────────┬─────────────────────────────┘
                            │ AES-256-GCM
                            ▼
┌─────────────────────────────────────────────────────────┐
│              secretos_sistema (en BD)                    │
│  • valor_cifrado (BYTEA)                                │
│  • iv (12 bytes)                                        │
│  • auth_tag (16 bytes)                                  │
└─────────────────────────────────────────────────────────┘
```

### Secretos del Sistema

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `JWT_SECRET` | JWT | Firma de tokens de autenticación |
| `HMAC_SALT` | HMAC | Salt para pseudónimos de jueces |
| `PFX_PASSWORD` | PKI | Contraseña de certificados .pfx |
| `DOCS_ENCRYPTION_KEY` | AES | Cifrado de documentos |
| `DATA_ENCRYPTION_KEY` | AES | **Cifrado de datos de funcionarios** |
| `SMTP_USER` | SMTP | Usuario de correo |
| `SMTP_PASSWORD` | SMTP | Contraseña de correo |

### Tablas

#### `secretos_sistema`
```sql
- secreto_id SERIAL PRIMARY KEY
- nombre VARCHAR(100) UNIQUE
- tipo tipo_secreto (JWT, HMAC, AES, PKI, API, SMTP, OTRO)
- valor_cifrado BYTEA
- iv BYTEA (12 bytes)
- auth_tag BYTEA (16 bytes)
- version INTEGER DEFAULT 1
- activo BOOLEAN DEFAULT TRUE
```

#### `historial_rotaciones`
```sql
- rotacion_id SERIAL PRIMARY KEY
- secreto_id INTEGER REFERENCES secretos_sistema
- version_anterior, version_nueva INTEGER
- hash_integridad VARCHAR(64)  -- Cadena de hash
```

---

## 📂 Ubicación de Scripts SQL

```
scripts/
├── usuarios/
│   └── 01_init_completo.sql       # Schema db_usuarios
├── casos/
│   └── 01_init_completo.sql       # Schema db_casos (871 líneas)
├── logs/
│   └── 01_init_completo.sql       # Schema db_logs
└── secrets/
    ├── 01_schema.sql              # Schema db_secrets
    └── 02_init_dev_secrets.sql    # Documentación de secretos
```

---

## 🐳 Contenedores Docker

| Contenedor | Base de Datos | Puerto | Usuario |
|------------|---------------|--------|---------|
| `juez_seguro_db_users` | db_usuarios | 5435 | admin_users |
| `juez_seguro_db_cases` | db_casos | 5433 | admin_cases |
| `juez_seguro_db_logs` | db_logs | 5434 | admin_logs |
| `juez_seguro_db_secrets` | db_secrets | 5436 | admin_secrets |

**Comando para iniciar:**
```bash
docker-compose up -d
```

---

## 🔒 Resumen de Seguridad

| Mecanismo | Base de Datos | Propósito |
|-----------|---------------|-----------|
| Cifrado AES-256-GCM | db_usuarios | Proteger identificación y nombres |
| Pseudonimización HMAC | db_casos | Ocultar identidad de jueces |
| Cadena de Hash | db_logs | Garantizar inmutabilidad de logs |
| Triggers de Inmutabilidad | db_casos | Proteger decisiones firmadas |
| Cifrado de Secretos | db_secrets | Proteger claves criptográficas |
| Sesiones Controladas | db_usuarios | Prevenir accesos concurrentes |

---

*Documento generado para el proyecto Juez Seguro - Sistema de Gestión Judicial*
*Versión: 1.0.0 | Última actualización: $(date)*
