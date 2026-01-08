# ============================================================================
# JUEZ SEGURO - Sprint 3: Configuracion de Infraestructura PKI (Windows)
# ============================================================================
# Este script genera la Autoridad Certificadora (CA) y los certificados
# digitales necesarios para la firma electronica de documentos judiciales.
# 
# Requisitos: OpenSSL instalado en el sistema
# Uso: .\setup_pki.ps1
# ============================================================================

param(
    [switch]$Force,
    [string]$PfxPassword = "Seguridad2026"
)

# Desactivar ErrorActionPreference para comandos externos
$ErrorActionPreference = "Continue"

Write-Host "=============================================="
Write-Host "  JUEZ SEGURO - Generacion de PKI Sprint 3"
Write-Host "=============================================="
Write-Host ""

# Verificar que OpenSSL este disponible
try {
    $opensslVersion = & openssl version 2>&1
    Write-Host "[OK] OpenSSL detectado: $opensslVersion" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] OpenSSL no esta instalado o no esta en el PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Opciones para instalar OpenSSL en Windows:" -ForegroundColor Yellow
    Write-Host "  1. Instalar Git for Windows (incluye OpenSSL)"
    Write-Host "  2. Descargar desde: https://slproweb.com/products/Win32OpenSSL.html"
    Write-Host "  3. Usar chocolatey: choco install openssl"
    Write-Host ""
    exit 1
}

# Crear estructura de directorios
Write-Host ""
Write-Host "[INFO] Creando estructura de directorios..." -ForegroundColor Cyan

$certsPath = Join-Path $PSScriptRoot "certs"
$caPath = Join-Path $certsPath "ca"
$serverPath = Join-Path $certsPath "server"
$juecesPath = Join-Path $certsPath "jueces"

New-Item -ItemType Directory -Force -Path $caPath | Out-Null
New-Item -ItemType Directory -Force -Path $serverPath | Out-Null
New-Item -ItemType Directory -Force -Path $juecesPath | Out-Null

# ============================================================================
# 1. AUTORIDAD CERTIFICADORA (CA)
# ============================================================================
Write-Host ""
Write-Host "--- 1. Generando Autoridad Certificadora (CA) ---" -ForegroundColor Yellow

$caKeyPath = Join-Path $caPath "ca.key"
$caCrtPath = Join-Path $caPath "ca.crt"

if ((Test-Path $caKeyPath) -and -not $Force) {
    Write-Host "[WARN] La CA ya existe. Use -Force para regenerarla" -ForegroundColor Yellow
}
else {
    # Clave privada de la CA (4096 bits)
    $null = & openssl genrsa -out $caKeyPath 4096 2>&1
    Write-Host "[OK] Clave privada CA generada: $caKeyPath" -ForegroundColor Green
    
    # Certificado publico de la CA (valido por 10 anios)
    $null = & openssl req -x509 -new -nodes -key $caKeyPath `
        -sha256 -days 3650 -out $caCrtPath `
        -subj "/C=EC/ST=Pichincha/L=Quito/O=JuezSeguro-Simulacion/OU=Infraestructura PKI/CN=RootCA-JuezSeguro" 2>&1
    Write-Host "[OK] Certificado CA generado: $caCrtPath" -ForegroundColor Green
}

# ============================================================================
# 2. CERTIFICADOS DE JUECES
# ============================================================================
Write-Host ""
Write-Host "--- 2. Generando Certificados de Jueces ---" -ForegroundColor Yellow

function Generate-JudgeCert {
    param(
        [int]$JuezId,
        [string]$JuezNombre,
        [string]$JuezEmail,
        [string]$Password
    )
    
    Write-Host "  [INFO] Generando certificado para Juez ID: $JuezId ($JuezNombre)" -ForegroundColor Cyan
    
    $keyPath = Join-Path $juecesPath "juez_$JuezId.key"
    $csrPath = Join-Path $juecesPath "juez_$JuezId.csr"
    $crtPath = Join-Path $juecesPath "juez_$JuezId.crt"
    $pfxPath = Join-Path $juecesPath "juez_$JuezId.pfx"
    
    # Clave privada del Juez (2048 bits)
    $null = & openssl genrsa -out $keyPath 2048 2>&1
    
    # Solicitud de firma (CSR)
    $subj = "/C=EC/ST=Pichincha/L=Quito/O=Consejo de la Judicatura/OU=Jueces/CN=$JuezNombre/emailAddress=$JuezEmail"
    $null = & openssl req -new -key $keyPath -out $csrPath -subj $subj 2>&1
    
    # La CA firma el certificado del Juez (valido por 1 anio)
    $null = & openssl x509 -req -in $csrPath `
        -CA $caCrtPath -CAkey $caKeyPath `
        -CAcreateserial -out $crtPath `
        -days 365 -sha256 2>&1
    
    # Empaquetar en PKCS#12 (.pfx)
    $null = & openssl pkcs12 -export `
        -out $pfxPath `
        -inkey $keyPath `
        -in $crtPath `
        -certfile $caCrtPath `
        -passout "pass:$Password" 2>&1
    
    # Limpiar CSR
    Remove-Item $csrPath -Force -ErrorAction SilentlyContinue
    
    Write-Host "  [OK] Certificado generado: $pfxPath" -ForegroundColor Green
}

# Generar certificados para los jueces de prueba
Generate-JudgeCert -JuezId 10 -JuezNombre "Juan Perez" -JuezEmail "juan.perez@justice.ec" -Password $PfxPassword
Generate-JudgeCert -JuezId 11 -JuezNombre "Maria Garcia" -JuezEmail "maria.garcia@justice.ec" -Password $PfxPassword
Generate-JudgeCert -JuezId 12 -JuezNombre "Carlos Lopez" -JuezEmail "carlos.lopez@justice.ec" -Password $PfxPassword

# ============================================================================
# 3. SECRETOS DE INFRAESTRUCTURA
# ============================================================================
Write-Host ""
Write-Host "--- 3. Generando Secretos de Infraestructura ---" -ForegroundColor Yellow

$saltPath = Join-Path $certsPath "anonymization.salt"
$jwtPath = Join-Path $certsPath "jwt_secret.key"
$docsKeyPath = Join-Path $certsPath "docs_encryption.key"

# Salt para anonimizacion (32 bytes en hexadecimal)
$saltValue = & openssl rand -hex 32 2>&1
$saltValue | Out-File -FilePath $saltPath -NoNewline -Encoding ascii
Write-Host "[OK] Salt de anonimizacion: $saltPath" -ForegroundColor Green

# Clave secreta para JWT (64 bytes en base64)
$jwtSecret = & openssl rand -base64 64 2>&1
$jwtSecret = $jwtSecret -replace "`n", "" -replace "`r", ""
$jwtSecret | Out-File -FilePath $jwtPath -NoNewline -Encoding ascii
Write-Host "[OK] Clave JWT generada: $jwtPath" -ForegroundColor Green

# Clave para cifrado de documentos en reposo (AES-256)
$docsKey = & openssl rand -hex 32 2>&1
$docsKey | Out-File -FilePath $docsKeyPath -NoNewline -Encoding ascii
Write-Host "[OK] Clave de cifrado de documentos: $docsKeyPath" -ForegroundColor Green

# ============================================================================
# 4. CREAR ARCHIVO .gitignore PARA CERTS
# ============================================================================
Write-Host ""
Write-Host "--- 4. Creando .gitignore para proteger secretos ---" -ForegroundColor Yellow

$gitignoreContent = @"
# JUEZ SEGURO - Archivos PKI (NO COMMITEAR A GIT)

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

# Mantener solo el certificado publico de la CA
!ca/ca.crt
"@

$gitignorePath = Join-Path $certsPath ".gitignore"
$gitignoreContent | Out-File -FilePath $gitignorePath -Encoding utf8
Write-Host "[OK] .gitignore creado en certs/" -ForegroundColor Green

# ============================================================================
# RESUMEN FINAL
# ============================================================================
Write-Host ""
Write-Host "=============================================="
Write-Host "  [OK] INFRAESTRUCTURA PKI GENERADA" -ForegroundColor Green
Write-Host "=============================================="
Write-Host ""
Write-Host "Estructura generada:" -ForegroundColor Cyan
Write-Host "   certs/"
Write-Host "   +-- ca/"
Write-Host "   |   +-- ca.key          (Clave privada CA)"
Write-Host "   |   +-- ca.crt          (Certificado publico CA)"
Write-Host "   +-- jueces/"
Write-Host "   |   +-- juez_10.*       (Juan Perez)"
Write-Host "   |   +-- juez_11.*       (Maria Garcia)"
Write-Host "   |   +-- juez_12.*       (Carlos Lopez)"
Write-Host "   +-- anonymization.salt  (Salt anonimizacion)"
Write-Host "   +-- jwt_secret.key      (Secreto JWT)"
Write-Host "   +-- docs_encryption.key (Clave AES-256)"
Write-Host "   +-- .gitignore"
Write-Host ""
Write-Host "Password de archivos .pfx: $PfxPassword" -ForegroundColor Yellow
Write-Host ""
Write-Host "[WARN] Las claves privadas NO deben subirse a Git" -ForegroundColor Red
Write-Host ""
