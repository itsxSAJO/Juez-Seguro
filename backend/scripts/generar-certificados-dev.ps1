# ============================================================================
# JUEZ SEGURO - Generador de Certificados de Desarrollo
# ============================================================================
# ADVERTENCIA: Estos certificados son SOLO para desarrollo/testing.
# NO usar en producción - generar con HSM/PKI real.
# ============================================================================

$ErrorActionPreference = "Stop"

# Directorio de certificados
$certsDir = Join-Path $PSScriptRoot "..\certs"
$caDir = Join-Path $certsDir "ca"
$juecesDir = Join-Path $certsDir "jueces"

# Crear directorios si no existen
New-Item -ItemType Directory -Force -Path $caDir | Out-Null
New-Item -ItemType Directory -Force -Path $juecesDir | Out-Null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Generador de Certificados de Prueba" -ForegroundColor Cyan
Write-Host " SOLO PARA DESARROLLO" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

# Verificar si OpenSSL está disponible
try {
    $opensslVersion = & openssl version 2>&1
    Write-Host "OpenSSL detectado: $opensslVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: OpenSSL no encontrado. Instalar OpenSSL o usar Git Bash." -ForegroundColor Red
    Write-Host "Puede instalar con: winget install OpenSSL.Light" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# 1. GENERAR CA (Autoridad Certificadora de Prueba)
# ============================================================================
Write-Host "`n[1/3] Generando Autoridad Certificadora (CA)..." -ForegroundColor Yellow

$caKeyPath = Join-Path $caDir "ca.key"
$caCertPath = Join-Path $caDir "ca.crt"

if (-not (Test-Path $caCertPath)) {
    # Generar clave privada de CA
    & openssl genrsa -out $caKeyPath 4096 2>$null
    
    # Generar certificado de CA autofirmado
    & openssl req -x509 -new -nodes -key $caKeyPath -sha256 -days 3650 `
        -out $caCertPath `
        -subj "/C=EC/ST=Pichincha/L=Quito/O=Consejo de la Judicatura/OU=PKI/CN=CA Judicatura Ecuador Dev"
    
    Write-Host "  CA creada: $caCertPath" -ForegroundColor Green
} else {
    Write-Host "  CA ya existe, omitiendo..." -ForegroundColor Gray
}

# ============================================================================
# 2. GENERAR CERTIFICADOS PARA JUECES
# ============================================================================
Write-Host "`n[2/3] Generando certificados para jueces..." -ForegroundColor Yellow

# Lista de jueces (ID, Nombre, Email)
$jueces = @(
    @{ Id = 2; Nombre = "Maria Elena Gutierrez Salas"; Email = "juez.gutierrez@judicatura.gob.ec" }
    @{ Id = 8; Nombre = "Juez Asignado Sistema"; Email = "juez.sistema@judicatura.gob.ec" }
    # Agregar más jueces aquí si es necesario
)

foreach ($juez in $jueces) {
    $juezId = $juez.Id
    $juezNombre = $juez.Nombre
    $juezEmail = $juez.Email
    
    $keyPath = Join-Path $juecesDir "juez_$juezId.key"
    $csrPath = Join-Path $juecesDir "juez_$juezId.csr"
    $crtPath = Join-Path $juecesDir "juez_$juezId.crt"
    
    if (-not (Test-Path $crtPath)) {
        Write-Host "  Generando certificado para Juez $juezId ($juezNombre)..." -ForegroundColor Cyan
        
        # Generar clave privada
        & openssl genrsa -out $keyPath 2048 2>$null
        
        # Generar CSR (Certificate Signing Request)
        & openssl req -new -key $keyPath `
            -out $csrPath `
            -subj "/C=EC/ST=Pichincha/L=Quito/O=Funcion Judicial/OU=Jueces/CN=$juezNombre/emailAddress=$juezEmail"
        
        # Firmar con la CA (válido por 2 años)
        & openssl x509 -req -in $csrPath `
            -CA $caCertPath -CAkey $caKeyPath -CAcreateserial `
            -out $crtPath -days 730 -sha256
        
        # Eliminar CSR (no necesario después de firmar)
        Remove-Item $csrPath -Force -ErrorAction SilentlyContinue
        
        Write-Host "    Certificado creado: $crtPath" -ForegroundColor Green
    } else {
        Write-Host "  Certificado de Juez $juezId ya existe, omitiendo..." -ForegroundColor Gray
    }
}

# ============================================================================
# 3. VERIFICAR CERTIFICADOS
# ============================================================================
Write-Host "`n[3/3] Verificando certificados..." -ForegroundColor Yellow

foreach ($juez in $jueces) {
    $juezId = $juez.Id
    $crtPath = Join-Path $juecesDir "juez_$juezId.crt"
    
    if (Test-Path $crtPath) {
        $subject = & openssl x509 -in $crtPath -noout -subject 2>&1
        $dates = & openssl x509 -in $crtPath -noout -dates 2>&1
        Write-Host "  Juez $juezId`: $subject" -ForegroundColor Green
        Write-Host "    $dates" -ForegroundColor Gray
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Certificados generados exitosamente!" -ForegroundColor Green
Write-Host " Ubicacion: $certsDir" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
