# 🏛️ Juez Seguro

Sistema Judicial Electrónico con controles de seguridad basados en **Common Criteria EAL2**.

> **Versión 1.0.0** | Proyecto académico - EPN | 8vo Semestre | Desarrollo de Software Seguro

[![Security Rating](https://img.shields.io/badge/security-A-brightgreen)](https://sonarcloud.io)
[![Vulnerabilities](https://img.shields.io/badge/vulnerabilities-0-brightgreen)](https://sonarcloud.io)

---

## 📋 Índice

- [Visión General](#-visión-general)
- [Características de Seguridad](#-características-de-seguridad)
- [Arquitectura](#-arquitectura)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Uso](#-uso)
- [API Endpoints](#-api-endpoints)
- [Documentación](#-documentación)
- [Tecnologías](#️-tecnologías)
- [Desarrollo](#-desarrollo)

---

## 🎯 Visión General

**Juez Seguro** es un sistema judicial electrónico diseñado con controles de seguridad de nivel **Common Criteria EAL2+**, enfocado en la protección de datos sensibles de procesos judiciales mediante:

- 🔐 **Autenticación robusta** con bcrypt y JWT
- 🛡️ **Cifrado de datos** sensibles con AES-256-GCM
- 📝 **Firma digital** de decisiones judiciales con PKI
- 🔍 **Auditoría inmutable** con cadena de hashes
- 👤 **Pseudonimización** de jueces para protección de identidad
- 📧 **Notificaciones** automáticas de plazos judiciales

---

## 🔐 Características de Seguridad

### Common Criteria - Familias Implementadas

| Familia | Componente | Implementación |
|---------|------------|----------------|
| **FIA** | Identificación y Autenticación | • Bcrypt (12 rounds)<br>• Bloqueo tras 5 intentos<br>• JWT con expiración (30min)<br>• Gestión de sesiones activas |
| **FDP** | Protección de Datos | • Cifrado AES-256-GCM<br>• Pseudonimización SHA-256<br>• 4 bases de datos segregadas<br>• Validación de tipos con Zod |
| **FAU** | Auditoría | • Logs inmutables<br>• Hash encadenado SHA-256<br>• Verificación de integridad<br>• Registro de acciones sensibles |
| **FCS** | Soporte Criptográfico | • PKI completa (CA + certificados)<br>• Firma digital de documentos<br>• Rotación de secretos<br>• Gestión segura de claves |
| **FPT** | Protección del TOE | • Rate limiting<br>• Helmet.js (headers seguros)<br>• CORS configurado<br>• Sanitización de entradas |

### Controles de Seguridad Adicionales

- ✅ **XSS Protection**: DOMPurify + CSP headers
- ✅ **SQL Injection**: Consultas parametrizadas
- ✅ **CSRF**: Tokens de sesión únicos
- ✅ **Rate Limiting**: 100 req/15min por IP
- ✅ **Secure Cookies**: HttpOnly, Secure, SameSite
- ✅ **Validación de Entrada**: Zod schemas en backend y frontend
- ✅ **Logs Estructurados**: Registros con formato JSON

---

## 📁 Arquitectura

### Estructura del Proyecto

```
Juez-Seguro/
├── backend/                    # API Express.js + TypeScript
│   ├── src/
│   │   ├── config/            # Configuración centralizada
│   │   ├── db/                # Conexiones a 4 bases de datos
│   │   ├── middleware/        # Autenticación, validación, rate-limit
│   │   ├── routes/            # Endpoints REST
│   │   ├── services/          # Lógica de negocio
│   │   ├── types/             # Definiciones TypeScript
│   │   └── utils/             # Utilidades (crypto, logger, pdf)
│   ├── certs/                 # Certificados PKI generados
│   ├── secure_docs_storage/   # Almacenamiento de documentos firmados
│   ├── scripts/               # Scripts de migración y seed
│   └── tests/                 # Tests unitarios e integración
│
├── frontend/                   # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── components/        # Componentes reutilizables (shadcn/ui)
│   │   ├── contexts/          # Context API (Auth, Theme)
│   │   ├── hooks/             # Custom hooks
│   │   ├── lib/               # Utilidades y adaptadores
│   │   ├── pages/             # Páginas de la aplicación
│   │   ├── services/          # Servicios API
│   │   └── types/             # Tipos compartidos
│   └── public/                # Assets estáticos
│
├── scripts/                    # Scripts SQL de inicialización
│   ├── usuarios/              # Schema FIA (autenticación)
│   ├── casos/                 # Schema FDP (datos protegidos)
│   ├── logs/                  # Schema FAU (auditoría)
│   └── secrets/               # Schema FCS (criptografía)
│
├── certs/                      # Infraestructura PKI
│   ├── ca/                    # Autoridad Certificadora
│   ├── server/                # Certificados del servidor
│   └── jueces/                # Certificados de jueces
│
├── docs/                       # Documentación técnica
│   ├── ARQUITECTURA-BASES-DATOS.md
│   ├── DESPLIEGUE-AWS-EC2.md
│   ├── HU-*.md                # Historias de usuario
│   └── SEGURIDAD-*.md         # Documentación de seguridad
│
├── docker-compose.yml         # Infraestructura PostgreSQL (4 nodos)
├── setup_pki.sh               # Script de generación de PKI (Linux/Mac)
├── setup_pki.ps1              # Script de generación de PKI (Windows)
├── sonar-project.properties   # Configuración SonarCloud
└── README.md
```

### Arquitectura de Bases de Datos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA DE DATOS                                 │
├──────────────────┬──────────────────┬───────────────────┬───────────────────┤
│   db_usuarios    │    db_casos      │     db_logs       │    db_secrets     │
│   Puerto: 5435   │   Puerto: 5433   │   Puerto: 5434    │   Puerto: 5436    │
├──────────────────┼──────────────────┼───────────────────┼───────────────────┤
│ • funcionarios   │ • causas         │ • logs_auditoria  │ • secretos_sistema│
│ • roles          │ • documentos     │ • audit_sesiones  │ • historial_      │
│ • sesiones_      │ • decisiones     │ • audit_accesos   │   rotaciones      │
│   activas        │ • audiencias     │ • audit_alertas   │                   │
│ • historial_     │ • notificaciones │                   │                   │
│   estados        │ • plazos         │                   │                   │
└──────────────────┴──────────────────┴───────────────────┴───────────────────┘
```

**Características:**
- **Segregación de datos**: Cada dominio en su propia base de datos
- **Cifrado**: Campos sensibles cifrados con AES-256-GCM
- **Pseudonimización**: Jueces identificados por hashes SHA-256
- **Auditoría**: Logs inmutables con cadena de integridad

---

## 📦 Requisitos

### Software Requerido

- **Node.js** 20+ (recomendado: 20.19.27)
- **Docker** 20+ y **Docker Compose** 2+
- **PostgreSQL** 15 (vía Docker)
- **OpenSSL** 1.1.1+ (para PKI)
- **Git** 2.30+

### Hardware Recomendado

- **RAM**: 8GB mínimo
- **Disco**: 10GB libres
- **CPU**: 2 cores mínimo

---

## 🚀 Instalación

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/juez-seguro.git
cd Juez-Seguro
```

### 2. Configurar Variables de Entorno

```bash
# Raíz del proyecto (para Docker)
cp .env.example .env

# Editar credenciales de bases de datos
nano .env
```

Variables clave en `.env`:
```env
DB_PASS_USERS=tu_password_seguro_1
DB_PASS_CASES=tu_password_seguro_2
DB_PASS_LOGS=tu_password_seguro_3
DB_PASS_SECRETS=tu_password_seguro_4
```

### 3. Generar Infraestructura PKI

**Linux/Mac:**
```bash
chmod +x setup_pki.sh
export PFX_PASSWORD="tu_password_seguro"
./setup_pki.sh
```

**Windows:**
```powershell
.\setup_pki.ps1 -Password "tu_password_seguro"
```

Esto genera:
- Autoridad Certificadora (CA)
- Certificados para jueces
- Certificados para el servidor

### 4. Iniciar Bases de Datos

```bash
docker-compose up -d
```

Verifica que los 4 contenedores estén corriendo:
```bash
docker ps
```

Deberías ver:
- `juez_seguro_db_users` (puerto 5435)
- `juez_seguro_db_cases` (puerto 5433)
- `juez_seguro_db_logs` (puerto 5434)
- `juez_seguro_db_secrets` (puerto 5436)

### 5. Inicializar Backend

```bash
cd backend
npm install

# Ejecutar migraciones
npm run db:migrate

# Migrar secretos criptográficos
npm run db:migrate-secrets

# Seed de datos de prueba (opcional)
npm run db:seed-users-dev

# Iniciar servidor en modo desarrollo
npm run dev
```

API disponible en: `http://localhost:3000/api`

### 6. Iniciar Frontend

```bash
cd frontend
npm install
npm run dev
```

Aplicación en: `http://localhost:5173`

---

## 🔑 Uso

### Credenciales de Prueba

| Rol | Email | Contraseña | Permisos |
|-----|-------|------------|----------|
| **CJ (Admin)** | cj@judicatura.gob.ec | cj123 | Administración completa, auditoría |
| **Juez** | juez@judicatura.gob.ec | juez123 | Firma de decisiones, consulta agenda |
| **Secretario** | secretario@judicatura.gob.ec | secretario123 | Gestión de causas, documentos |

### Funcionalidades por Rol

#### 👔 Consejo de la Judicatura (CJ)
- ✅ Registro y administración de cuentas de funcionarios
- ✅ Activación/desactivación de usuarios
- ✅ Revisión de registros de actividad (auditoría)
- ✅ Verificación de integridad de logs
- ✅ Generación de reportes de seguridad

#### ⚖️ Juez
- ✅ Control de acceso con autenticación multifactor
- ✅ Consulta de agenda y audiencias asignadas
- ✅ Elaboración de decisiones judiciales
- ✅ Firma digital de documentos
- ✅ Consulta de expedientes

#### 📝 Secretario Judicial
- ✅ Registro de nuevas causas
- ✅ Incorporación de documentos al expediente
- ✅ Programación de audiencias
- ✅ Gestión de notificaciones y plazos
- ✅ Actualización de estado de causas

#### 👤 Portal Ciudadano (Público)
- ✅ Consulta de expedientes por número de cédula
- ✅ Visualización de estado de procesos
- ✅ Descarga de documentos públicos
- ✅ Sin necesidad de autenticación

---

## 📡 API Endpoints

### Autenticación
```
POST   /api/auth/login              # Iniciar sesión
POST   /api/auth/logout             # Cerrar sesión
GET    /api/auth/me                 # Usuario actual
GET    /api/auth/sesiones           # Sesiones activas
DELETE /api/auth/sesiones/:id       # Cerrar sesión específica
```

### Causas (requiere auth)
```
GET    /api/causas                  # Listar causas
POST   /api/causas                  # Crear causa
GET    /api/causas/:id              # Detalle causa
PATCH  /api/causas/:id              # Actualizar causa
DELETE /api/causas/:id              # Eliminar causa
```

### Documentos (requiere auth)
```
GET    /api/documentos              # Listar documentos
POST   /api/documentos              # Subir documento
GET    /api/documentos/:id          # Descargar documento
DELETE /api/documentos/:id          # Eliminar documento
```

### Decisiones (requiere auth - Juez)
```
GET    /api/decisiones              # Listar decisiones
POST   /api/decisiones              # Crear decisión
GET    /api/decisiones/:id          # Detalle decisión
POST   /api/decisiones/:id/firmar   # Firmar decisión
GET    /api/decisiones/:id/verificar # Verificar firma
```

### Audiencias (requiere auth)
```
GET    /api/audiencias              # Listar audiencias
GET    /api/audiencias/hoy          # Audiencias del día
POST   /api/audiencias              # Programar audiencia
PATCH  /api/audiencias/:id          # Actualizar audiencia
DELETE /api/audiencias/:id          # Cancelar audiencia
```

### Notificaciones (requiere auth)
```
GET    /api/notificaciones          # Listar notificaciones
GET    /api/notificaciones/plazos   # Plazos próximos a vencer
POST   /api/notificaciones          # Crear notificación
PATCH  /api/notificaciones/:id      # Marcar como leída
```

### Portal Ciudadano (público)
```
GET    /api/publico/buscar?cedula=XXX       # Buscar procesos
GET    /api/publico/proceso/:id             # Detalle proceso
GET    /api/publico/documento/:id           # Documento público
```

### Auditoría (solo CJ)
```
GET    /api/auditoria                       # Logs de auditoría
GET    /api/auditoria/verificar-integridad  # Verificar cadena hash
GET    /api/auditoria/sesiones              # Historial de sesiones
GET    /api/auditoria/accesos               # Historial de accesos
GET    /api/auditoria/alertas               # Alertas de seguridad
```

### Administración (solo CJ)
```
GET    /api/admin/funcionarios              # Listar funcionarios
POST   /api/admin/funcionarios              # Crear funcionario
PATCH  /api/admin/funcionarios/:id          # Actualizar funcionario
DELETE /api/admin/funcionarios/:id          # Desactivar funcionario
POST   /api/admin/funcionarios/:id/desbloquear # Desbloquear cuenta
```

---

## 📚 Documentación

### Historias de Usuario
- [HU-CJ-001: Registro y Administración de Cuentas](docs/HU-CJ-001-Registro-Administracion-Cuentas.md)
- [HU-CJ-003: Revisión de Registros de Actividad](docs/HU-CJ-003-Revision-Registros-Actividad-COMPLETO.md)
- [HU-JZ-001: Control de Acceso de Jueces](docs/HU-JZ-001-Control-Acceso-Jueces-COMPLETO.md)
- [HU-JZ-002: Consulta de Agenda](docs/HU-JZ-002-Consulta-Agenda-Jueces-COMPLETO.md)
- [HU-JZ-003: Elaboración y Firma de Decisiones](docs/HU-JZ-003-Elaboracion-Firma-Decisiones-COMPLETO.md)
- [HU-SJ-001: Registro de Causas](docs/HU-SJ-001-Registro-Causas-COMPLETO.md)
- [HU-SJ-002: Incorporación de Documentos](docs/HU-SJ-002-Incorporacion-Documentos-COMPLETO.md)
- [HU-SJ-003: Gestión de Audiencias](docs/HU-SJ-003-Gestion-Audiencias-COMPLETO.md)
- [HU-SJ-004: Notificaciones y Plazos](docs/HU-SJ-004-Notificaciones-Plazos-COMPLETO.md)
- [HU-UP-001: Consulta Expediente Ciudadano](docs/HU-UP-001-Consulta-Expediente-Ciudadano-COMPLETO.md)

### Documentación Técnica
- [Arquitectura de Bases de Datos](docs/ARQUITECTURA-BASES-DATOS.md)
- [Despliegue en AWS EC2](docs/DESPLIEGUE-AWS-EC2.md)

### Documentación de Seguridad
- [Validación de Tipos en Runtime](docs/SEGURIDAD-VALIDACION-TIPOS-RUNTIME.md)
- [Protección XSS en Documentos](docs/SEGURIDAD-XSS-DOCUMENTOS.md)
- [Protección DOM-based XSS](docs/SEGURIDAD-DOM-XSS-EDITOR-DECISIONES.md)
- [Logger Estructurado](docs/SEGURIDAD-LOGGER-ESTRUCTURADO.md)
- [Gestión de Secretos](docs/SEGURIDAD-SECRETOS-HARDCODEADOS.md)
- [Secure Cookie Flag](docs/SEGURIDAD-COOKIE-SECURE-FLAG.md)
- [Hashes Bcrypt](docs/SEGURIDAD-CWE-798-HASHES-BCRYPT-SEED.md)

---

## 🛠️ Tecnologías

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js 4.18+
- **Lenguaje**: TypeScript 5.3+ (ESM)
- **Base de Datos**: PostgreSQL 15 (pg driver)
- **Autenticación**: bcryptjs, jsonwebtoken
- **Validación**: Zod
- **Seguridad**: Helmet, express-rate-limit, CORS
- **Criptografía**: crypto (Node.js), pdf-lib
- **Email**: Nodemailer
- **Utilidades**: uuid, axios, dotenv

### Frontend
- **Framework**: React 18
- **Bundler**: Vite 5
- **Lenguaje**: TypeScript 5+
- **Estilo**: Tailwind CSS 3
- **Componentes**: shadcn/ui (Radix UI)
- **Routing**: React Router DOM 6
- **Formularios**: React Hook Form + Zod
- **Query**: TanStack Query (React Query)
- **Iconos**: Lucide React
- **Fechas**: date-fns
- **Sanitización**: DOMPurify

### Infraestructura
- **Contenedores**: Docker + Docker Compose
- **Base de Datos**: PostgreSQL 15 Alpine
- **PKI**: OpenSSL 1.1.1+
- **CI/CD**: GitHub Actions (opcional)
- **Quality**: SonarCloud

### DevOps y Calidad
- **Linting**: ESLint
- **Testing**: Jest (backend), Vitest (frontend)
- **Security Scanning**: SonarCloud, npm audit
- **Logs**: Winston (estructurado JSON)

---

## 👨‍💻 Desarrollo

### Comandos de Desarrollo

```bash
# Backend (modo desarrollo con hot reload)
cd backend && npm run dev

# Frontend (modo desarrollo)
cd frontend && npm run dev

# Build para producción
cd backend && npm run build
cd frontend && npm run build

# Ejecutar tests
cd backend && npm test
cd frontend && npm test
```

### Scripts de Base de Datos

```bash
# Migraciones
cd backend && npm run db:migrate

# Seed de usuarios de desarrollo
cd backend && npm run db:seed-users-dev

# Migrar secretos criptográficos
cd backend && npm run db:migrate-secrets

# Configurar SMTP
cd backend && npm run smtp:configure
```

### Análisis de Código

```bash
# Análisis estático con SonarCloud
sonar-scanner

# Linting
cd backend && npm run lint
cd frontend && npm run lint

# Auditoría de seguridad
npm audit
```

### Docker

```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down

# Reiniciar servicios
docker-compose restart

# Limpiar volúmenes (⚠️ elimina datos)
docker-compose down -v
```

---

## 🔒 Seguridad

### Reporte de Vulnerabilidades

Si encuentras una vulnerabilidad de seguridad, por favor **NO** abras un issue público. Contacta directamente al equipo de desarrollo.

### Buenas Prácticas Implementadas

1. ✅ Nunca hardcodear credenciales
2. ✅ Usar variables de entorno para configuración sensible
3. ✅ Validar todas las entradas del usuario
4. ✅ Sanitizar salidas para prevenir XSS
5. ✅ Usar consultas parametrizadas (SQL Injection)
6. ✅ Implementar rate limiting
7. ✅ Logs estructurados sin información sensible
8. ✅ Rotación regular de secretos
9. ✅ Headers de seguridad (Helmet.js)
10. ✅ HTTPS en producción

---

## 🚀 Despliegue

### Entornos

- **Desarrollo**: `http://localhost:5173`
- **Producción**: Ver [DESPLIEGUE-AWS-EC2.md](docs/DESPLIEGUE-AWS-EC2.md)

### Variables de Entorno en Producción

```env
NODE_ENV=production
PORT=3000

# Base de datos
DB_HOST_USERS=tu-servidor-db.com
DB_PORT_USERS=5432
DB_NAME_USERS=db_usuarios
DB_USER_USERS=admin_users
DB_PASS_USERS=password_seguro_1

# JWT
JWT_SECRET=secret_muy_largo_y_aleatorio_minimo_32_caracteres

# PKI
PFX_PASSWORD=password_certificados

# SMTP (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notificaciones@judicatura.gob.ec
SMTP_PASS=password_smtp
```

---

## 📝 Licencia

Proyecto académico - EPN 2024-2025

---

## 👥 Equipo

Desarrollado por estudiantes de 8vo Semestre de Ingeniería de Software - EPN

---

## 📞 Soporte

Para soporte técnico o consultas académicas, contactar a través de los canales oficiales de la EPN.

---

## 🔄 Changelog

### Versión 1.0.0 (Enero 2026)
- ✨ Implementación completa de todas las historias de usuario
- 🔐 Infraestructura PKI completa con firma digital
- 🛡️ Cifrado AES-256-GCM de datos sensibles
- 📝 Sistema de auditoría inmutable
- 📧 Notificaciones automáticas por email
- 🔍 Portal ciudadano público
- ✅ Análisis de seguridad con SonarCloud
- 📚 Documentación completa

---

**¡Gracias por usar Juez Seguro!** 🏛️
