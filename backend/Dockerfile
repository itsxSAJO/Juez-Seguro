# ============================================================================
# JUEZ SEGURO - Backend API Dockerfile
# Sistema Judicial Electrónico con Common Criteria
# ============================================================================
# Imagen optimizada para Node.js con TypeScript
# Incluye configuración de seguridad y almacenamiento protegido
# ============================================================================

# Etapa 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependencias (incluyendo devDependencies para build)
RUN npm ci

# Copiar código fuente
COPY src ./src
COPY scripts ./scripts

# Compilar TypeScript a JavaScript
RUN npm run build

# ============================================================================
# Etapa 2: Production
FROM node:20-alpine

# Crear usuario no privilegiado para mayor seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copiar solo dependencias de producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar código compilado desde builder
COPY --from=builder /app/dist ./dist

# Copiar scripts de migración y utilidades
COPY --from=builder /app/scripts ./scripts
COPY tsconfig.json ./

# Crear directorio para almacenamiento seguro de documentos
RUN mkdir -p /app/storage/expedientes_seguros && \
    chown -R nodejs:nodejs /app/storage

# Cambiar a usuario no privilegiado
USER nodejs

# Exponer puerto de la API
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando de inicio
CMD ["node", "dist/index.js"]
