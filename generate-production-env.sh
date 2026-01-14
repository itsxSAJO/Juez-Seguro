#!/bin/bash
# ============================================================================
# JUEZ SEGURO - Generador de Variables de Entorno para Producción
# ============================================================================
# Este script genera contraseñas seguras aleatorias para el archivo .env
# 
# Uso:
#   chmod +x generate-production-env.sh
#   ./generate-production-env.sh
# ============================================================================

echo "============================================"
echo "🔐 Generador de Variables de Entorno"
echo "    Juez Seguro - Producción"
echo "============================================"
echo ""

# Verificar que openssl esté instalado
if ! command -v openssl &> /dev/null; then
    echo "❌ Error: openssl no está instalado"
    echo "   Instalar: sudo apt install openssl"
    exit 1
fi

# Generar contraseñas
DB_PASS_USERS=$(openssl rand -base64 32)
DB_PASS_CASES=$(openssl rand -base64 32)
DB_PASS_LOGS=$(openssl rand -base64 32)
DB_PASS_SECRETS=$(openssl rand -base64 32)
MASTER_KEY_PASSWORD=$(openssl rand -base64 48)

# Mostrar el archivo .env generado
cat > .env << EOF
# ============================================================================
# JUEZ SEGURO - Variables de Entorno para Producción
# ============================================================================
# Generado automáticamente: $(date)
# ============================================================================

# ============================================================================
# ENTORNO DE EJECUCIÓN
# ============================================================================
NODE_ENV=production

# ============================================================================
# CONTRASEÑAS DE BASES DE DATOS
# ============================================================================
DB_PASS_USERS=$DB_PASS_USERS
DB_PASS_CASES=$DB_PASS_CASES
DB_PASS_LOGS=$DB_PASS_LOGS
DB_PASS_SECRETS=$DB_PASS_SECRETS

# ============================================================================
# CLAVE MAESTRA (FCS - Cryptographic Support)
# ============================================================================
MASTER_KEY_PASSWORD=$MASTER_KEY_PASSWORD

# ============================================================================
# CONFIGURACIÓN JWT
# ============================================================================
JWT_EXPIRATION=8h
EOF

echo "✅ Archivo .env creado exitosamente"
echo ""
echo "📋 Resumen de contraseñas generadas:"
echo "-------------------------------------------"
echo "DB_PASS_USERS:        ${DB_PASS_USERS:0:20}..."
echo "DB_PASS_CASES:        ${DB_PASS_CASES:0:20}..."
echo "DB_PASS_LOGS:         ${DB_PASS_LOGS:0:20}..."
echo "DB_PASS_SECRETS:      ${DB_PASS_SECRETS:0:20}..."
echo "MASTER_KEY_PASSWORD:  ${MASTER_KEY_PASSWORD:0:20}..."
echo "-------------------------------------------"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   1. Guarda estas contraseñas en un gestor seguro"
echo "   2. NO subas el archivo .env al repositorio"
echo "   3. El archivo .env ha sido creado en el directorio actual"
echo ""
echo "🚀 Siguiente paso:"
echo "   docker-compose up -d --build"
echo ""
