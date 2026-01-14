# 🏛️ Juez Seguro

Sistema Judicial Electrónico con controles de seguridad basados en **Common Criteria**.

> Proyecto académico - EPN | 8vo Semestre | Desarrollo de Software Seguro

---

## � Despliegue en Producción (AWS EC2)

**✨ Este repositorio está listo para producción sin modificaciones manuales.**

Para desplegar en AWS EC2, sigue la guía completa: **[DESPLIEGUE-AWS-EC2.md](docs/DESPLIEGUE-AWS-EC2.md)**

**Inicio rápido:**
1. Clonar rama `production`
2. Configurar `.env` con contraseñas seguras
3. Ejecutar `docker-compose up -d --build`

**Ya incluye:**
- ✅ NODE_ENV=production por defecto
- ✅ Puertos de BD no expuestos
- ✅ Red Docker aislada
- ✅ Configuración production-ready

---

## �📁 Estructura del Proyecto

```
Juez-Seguro/
├── backend/              # API Express.js + TypeScript
│   ├── src/
│   │   ├── config/       # Configuración centralizada
│   │   ├── db/           # Conexiones a PostgreSQL
│   │   ├── middleware/   # Autenticación JWT
│   │   ├── routes/       # Endpoints REST
│   │   ├── services/     # Lógica de negocio
│   │   └── types/        # Definiciones TypeScript
│   ├── .env              # Variables de entorno (no subir a git)
│   └── package.json
│
├── frontend/             # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/   # Componentes React
│   │   ├── contexts/     # Context API (Auth)
│   │   ├── hooks/        # Custom hooks
│   │   ├── lib/          # Utilidades y adaptadores
│   │   ├── pages/        # Páginas de la aplicación
│   │   ├── services/     # Servicios API
│   │   └── types/        # Tipos compartidos
│   ├── .env              # Variables Vite
│   └── package.json
│
├── scripts/              # Scripts SQL de inicialización
│   ├── usuarios/         # Schema FIA (autenticación)
│   ├── casos/            # Schema FDP (datos protegidos)
│   └── logs/             # Schema FAU (auditoría)
│
├── docker-compose.yml    # Infraestructura PostgreSQL
├── .env                  # Variables para Docker (DB passwords)
└── README.md
```

---

## 🔐 Controles Common Criteria

| Familia | Componente | Descripción |
|---------|------------|-------------|
| **FIA** | Identificación y Autenticación | Bcrypt (12 rounds), bloqueo tras 5 intentos, JWT 30min |
| **FDP** | Protección de Datos | Pseudonimización SHA-256, bases de datos aisladas |
| **FAU** | Auditoría | Logs inmutables con hash encadenado |

---

## 🚀 Inicio Rápido

### 1. Configurar Variables de Entorno

```bash
# Raíz (para Docker)
cp .env.example .env

# Ya configurados para desarrollo:
# - backend/.env
# - frontend/.env
```

### 2. Iniciar Bases de Datos

```bash
docker-compose up -d
```

Esto levanta 3 contenedores PostgreSQL:
- `db_usuarios` → puerto 5432
- `db_casos` → puerto 5433  
- `db_logs` → puerto 5434

### 3. Iniciar Backend

```bash
cd backend
npm install
npm run dev
```

API disponible en: `http://localhost:3000/api`

### 4. Iniciar Frontend

```bash
cd frontend
npm install
npm run dev
```

Aplicación en: `http://localhost:5173`

---

## 🔑 Credenciales de Prueba

| Rol | Email | Contraseña |
|-----|-------|------------|
| CJ (Admin) | cj@judicatura.gob.ec | cj123 |
| Juez | juez@judicatura.gob.ec | juez123 |
| Secretario | secretario@judicatura.gob.ec | secretario123 |

---

## 📡 API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/me` - Usuario actual

### Causas (requiere auth)
- `GET /api/causas` - Listar causas
- `POST /api/causas` - Crear causa
- `GET /api/causas/:id` - Detalle causa

### Audiencias (requiere auth)
- `GET /api/audiencias` - Listar audiencias
- `GET /api/audiencias/hoy` - Audiencias del día
- `POST /api/audiencias` - Programar audiencia

### Portal Ciudadano (público)
- `GET /api/publico/buscar?cedula=XXX` - Buscar procesos
- `GET /api/publico/proceso/:id` - Detalle proceso

### Auditoría (solo CJ)
- `GET /api/auditoria` - Logs de auditoría
- `GET /api/auditoria/verificar-integridad` - Verificar cadena hash

---

## 🛠️ Tecnologías

### Backend
- Node.js + Express.js
- TypeScript (ESM)
- PostgreSQL + pg driver
- bcryptjs, jsonwebtoken, Zod, Helmet

### Frontend
- React 18 + Vite
- TypeScript
- Tailwind CSS + shadcn/ui
- React Router DOM

### Infraestructura
- Docker + Docker Compose
- PostgreSQL 15 Alpine

---

## 👨‍💻 Desarrollo

```bash
# Backend (modo desarrollo con hot reload)
cd backend && npm run dev

# Frontend (modo desarrollo)
cd frontend && npm run dev

# Build producción
cd backend && npm run build
cd frontend && npm run build
```

---

## 📝 Licencia

Proyecto académico - EPN 2024-2025
