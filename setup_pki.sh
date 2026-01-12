#!/bin/bash
# ============================================================================
# JUEZ SEGURO - Sprint 3: Configuración de Infraestructura PKI
# ============================================================================
# Este script genera la Autoridad Certificadora (CA) y los certificados
# digitales necesarios para la firma electrónica de documentos judiciales.
# 
# Requisitos: OpenSSL instalado en el sistema
# Uso: ./setup_pki.sh <contraseña> o export PFX_PASSWORD=<contraseña>
# ============================================================================

set -e  # Salir en caso de error

echo "=============================================="
echo "  JUEZ SEGURO - Generación de PKI Sprint 3"
echo "=============================================="
echo ""

# ============================================================================
# VALIDACIÓN DE SEGURIDAD DE CREDENCIALES
# ============================================================================
# [SEGURIDAD S2068] Obtener contraseña de variable de entorno o argumento
# Nunca hardcodear contraseñas en scripts

if [ -z "$1" ]; then
    # Si no se proporciona como argumento, intentar obtener de variable de entorno
    if [ -z "${PFX_PASSWORD}" ]; then
        echo "[ERROR] Falta la contraseña para los certificados PFX." >&2
        echo ""
        echo "Debe proporcionar la contraseña de una de las siguientes formas:"
        echo "  1. Como argumento: ./setup_pki.sh 'SuClaveSegura'"
        echo "  2. Como variable de entorno: export PFX_PASSWORD='SuClaveSegura'"
        echo ""
        exit 1
    fi
    PFX_PASSWORD_FINAL="${PFX_PASSWORD}"
    echo "[INFO] Usando contraseña PFX desde variable de entorno PFX_PASSWORD."
else
    PFX_PASSWORD_FINAL="$1"
    echo "[INFO] Usando contraseña PFX proporcionada como argumento."
fi

echo ""

# Crear estructura de directorios
echo "📁 Creando estructura de directorios..."
mkdir -p certs/{ca,server,jueces}

# ============================================================================
# 1. AUTORIDAD CERTIFICADORA (CA)
# ============================================================================
echo ""
echo "--- 1. Generando Autoridad Certificadora (CA) ---"

# Verificar si la CA ya existe
if [ -f "certs/ca/ca.key" ]; then
    echo "⚠️  La CA ya existe. ¿Desea regenerarla? (s/N)"
    read -r response
    if [ "$response" != "s" ] && [ "$response" != "S" ]; then
        echo "Manteniendo CA existente..."
    else
        # Clave privada de la CA (4096 bits para máxima seguridad)
        openssl genrsa -out certs/ca/ca.key 4096
        echo "✅ Clave privada CA generada: certs/ca/ca.key"
        
        # Certificado público de la CA (válido por 10 años)
        openssl req -x509 -new -nodes -key certs/ca/ca.key \
          -sha256 -days 3650 -out certs/ca/ca.crt \
          -subj "/C=EC/ST=Pichincha/L=Quito/O=JuezSeguro-Simulacion/OU=Infraestructura PKI/CN=RootCA-JuezSeguro"
        echo "✅ Certificado CA generado: certs/ca/ca.crt"
    fi
else
    # Clave privada de la CA
    openssl genrsa -out certs/ca/ca.key 4096
    echo "✅ Clave privada CA generada: certs/ca/ca.key"
    
    # Certificado público de la CA
    openssl req -x509 -new -nodes -key certs/ca/ca.key \
      -sha256 -days 3650 -out certs/ca/ca.crt \
      -subj "/C=EC/ST=Pichincha/L=Quito/O=JuezSeguro-Simulacion/OU=Infraestructura PKI/CN=RootCA-JuezSeguro"
    echo "✅ Certificado CA generado: certs/ca/ca.crt"
fi

# ============================================================================
# 2. CERTIFICADOS DE JUECES (Simulación de Token USB)
# ============================================================================
echo ""
echo "--- 2. Generando Certificados de Jueces ---"

# Función para generar certificado de juez
generate_judge_cert() {
    local JUEZ_ID=$1
    local JUEZ_NOMBRE=$2
    local JUEZ_EMAIL=$3
    local PFX_PASSWORD=$4
    
    echo "  📜 Generando certificado para Juez ID: $JUEZ_ID ($JUEZ_NOMBRE)"
    
    # Clave privada del Juez (2048 bits)
    openssl genrsa -out "certs/jueces/juez_${JUEZ_ID}.key" 2048 2>/dev/null
    
    # Solicitud de firma (CSR)
    openssl req -new -key "certs/jueces/juez_${JUEZ_ID}.key" \
      -out "certs/jueces/juez_${JUEZ_ID}.csr" \
      -subj "/C=EC/ST=Pichincha/L=Quito/O=Consejo de la Judicatura/OU=Jueces/CN=${JUEZ_NOMBRE}/emailAddress=${JUEZ_EMAIL}"
    
    # La CA firma el certificado del Juez (válido por 1 año)
    openssl x509 -req -in "certs/jueces/juez_${JUEZ_ID}.csr" \
      -CA certs/ca/ca.crt -CAkey certs/ca/ca.key \
      -CAcreateserial -out "certs/jueces/juez_${JUEZ_ID}.crt" \
      -days 365 -sha256 2>/dev/null
    
    # Empaquetar en PKCS#12 (.pfx) para uso en aplicaciones
    openssl pkcs12 -export \
      -out "certs/jueces/juez_${JUEZ_ID}.pfx" \
      -inkey "certs/jueces/juez_${JUEZ_ID}.key" \
      -in "certs/jueces/juez_${JUEZ_ID}.crt" \
      -certfile certs/ca/ca.crt \
      -passout "pass:${PFX_PASSWORD}"
    
    # Limpiar CSR (no se necesita después)
    rm -f "certs/jueces/juez_${JUEZ_ID}.csr"
    
    echo "  ✅ Certificado generado: certs/jueces/juez_${JUEZ_ID}.pfx"
}

# Generar certificados para los jueces de prueba
# [SEGURIDAD S2068] Usar variable validada en lugar de hardcodeada

# Juez ID 10 - Juan Pérez (juez principal de pruebas)
generate_judge_cert "10" "Juan Perez" "juan.perez@justice.ec" "$PFX_PASSWORD_FINAL"

# Juez ID 11 - María García (juez secundario de pruebas)
generate_judge_cert "11" "Maria Garcia" "maria.garcia@justice.ec" "$PFX_PASSWORD_FINAL"

# Juez ID 12 - Carlos López (juez adicional)
generate_judge_cert "12" "Carlos Lopez" "carlos.lopez@justice.ec" "$PFX_PASSWORD_FINAL"

# ============================================================================
# 3. SECRETOS DE INFRAESTRUCTURA
# ============================================================================
echo ""
echo "--- 3. Generando Secretos de Infraestructura ---"

# Salt para anonimización (32 bytes en hexadecimal)
openssl rand -hex 32 > certs/anonymization.salt
echo "✅ Salt de anonimización: certs/anonymization.salt"

# Clave secreta para JWT (64 bytes en base64)
openssl rand -base64 64 | tr -d '\n' > certs/jwt_secret.key
echo "✅ Clave JWT generada: certs/jwt_secret.key"

# Clave para cifrado de documentos en reposo (AES-256)
openssl rand -hex 32 > certs/docs_encryption.key
echo "✅ Clave de cifrado de documentos: certs/docs_encryption.key"

# ============================================================================
# 4. CONFIGURACIÓN DE PERMISOS (Solo Unix/Linux)
# ============================================================================
echo ""
echo "--- 4. Configurando permisos de seguridad ---"

# Permisos restrictivos para claves privadas
chmod 600 certs/ca/ca.key 2>/dev/null || true
chmod 600 certs/jueces/*.key 2>/dev/null || true
chmod 600 certs/jueces/*.pfx 2>/dev/null || true
chmod 600 certs/*.salt 2>/dev/null || true
chmod 600 certs/*.key 2>/dev/null || true

# Permisos de lectura para certificados públicos
chmod 644 certs/ca/ca.crt 2>/dev/null || true
chmod 644 certs/jueces/*.crt 2>/dev/null || true

echo "✅ Permisos configurados"

# ============================================================================
# 5. CREAR ARCHIVO .gitignore PARA CERTS
# ============================================================================
echo ""
echo "--- 5. Creando .gitignore para proteger secretos ---"

cat > certs/.gitignore << 'EOF'
# ============================================================================
# JUEZ SEGURO - Archivos PKI (NO COMMITEAR A GIT)
# ============================================================================

# Claves privadas (NUNCA subir al repositorio)
*.key
*.pfx
*.p12

# Secretos de infraestructura
*.salt
jwt_secret.key
docs_encryption.key

# Archivos temporales de OpenSSL
*.csr
*.srl

# Mantener solo el certificado público de la CA
!ca/ca.crt
EOF

echo "✅ .gitignore creado en certs/"

# ============================================================================
# RESUMEN FINAL
# ============================================================================
echo ""
echo "=============================================="
echo "  ✅ INFRAESTRUCTURA PKI GENERADA CORRECTAMENTE"
echo "=============================================="
echo ""
echo "📁 Estructura generada:"
echo "   certs/"
echo "   ├── ca/"
echo "   │   ├── ca.key          (Clave privada CA - ¡PROTEGER!)"
echo "   │   └── ca.crt          (Certificado público CA)"
echo "   ├── jueces/"
echo "   │   ├── juez_10.key     (Clave privada Juan Pérez)"
echo "   │   ├── juez_10.crt     (Certificado Juan Pérez)"
echo "   │   ├── juez_10.pfx     (PKCS#12 para firma)"
echo "   │   ├── juez_11.*       (María García)"
echo "   │   └── juez_12.*       (Carlos López)"
echo "   ├── anonymization.salt  (Salt para anonimización)"
echo "   ├── jwt_secret.key      (Secreto JWT)"
echo "   ├── docs_encryption.key (Clave cifrado AES-256)"
echo "   └── .gitignore          (Protección de secretos)"
echo ""
echo "🔐 Certificados generados exitosamente."
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - Las claves privadas NO deben subirse a Git"
echo "   - En producción, usar Docker Secrets o HashiCorp Vault"
echo "   - La contraseña se obtuvo de forma segura (variable de entorno o argumento)"
echo "   - Cambiar passwords en entorno de producción"
echo ""
