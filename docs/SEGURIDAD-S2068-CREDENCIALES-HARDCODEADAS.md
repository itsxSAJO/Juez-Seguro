# Mitigación de Vulnerabilidad S2068: Credenciales Hardcodeadas

## Problema Identificado

**Severidad:** 🔴 CRÍTICO  
**CWE:** CWE-798 (Use of Hard-coded Credentials)  
**Sonar:** S2068 (Credentials should not be hard-coded)

### Descripción del Hallazgo

Los scripts de configuración PKI contenían contraseñas hardcodeadas:

- **setup_pki.ps1 (línea 13):** `[string]$PfxPassword = "Seguridad2026"`
- **setup_pki.sh (línea 103):** `PFX_DEFAULT_PASSWORD="Seguridad2026"`

### Impacto de Seguridad

1. **Rotura de la Cadena de Confianza:** Cualquiera con acceso al repositorio conoce la contraseña maestra de los certificados .pfx para jueces
2. **Riesgo de Firma Fraudulenta:** Un atacante podría generar certificados digitales falsos para firmar decisiones judiciales
3. **Cumplimiento Normativo:** Viola estándares de seguridad para sistemas judiciales (LOPD, ISO 27001)
4. **Exposición de Secretos:** La contraseña está visible en:
   - Historial de git
   - Logs de CI/CD
   - Acceso al repositorio

---

## Solución Implementada

### Cambios en `setup_pki.ps1`

#### Antes:
```powershell
param(
    [switch]$Force,
    [string]$PfxPassword = "Seguridad2026"  # ❌ INSEGURO
)
```

#### Después:
```powershell
param(
    [switch]$Force,
    # [SEGURIDAD S2068] Eliminado valor por defecto hardcodeado.
    [string]$PfxPassword
)

# VALIDACIÓN DE SEGURIDAD DE CREDENCIALES
if ([string]::IsNullOrWhiteSpace($PfxPassword)) {
    if ($env:PFX_PASSWORD) {
        $PfxPassword = $env:PFX_PASSWORD
        Write-Host "[INFO] Usando contraseña PFX desde variable de entorno PFX_PASSWORD." -ForegroundColor Cyan
    }
    else {
        Write-Host "[ERROR] Falta la contraseña para los certificados PFX." -ForegroundColor Red
        Write-Host "Debe proporcionar la contraseña de una de las siguientes formas:" -ForegroundColor Yellow
        Write-Host "  1. Como argumento: .\setup_pki.ps1 -PfxPassword 'SuClaveSegura'"
        Write-Host "  2. Como variable de entorno: `$env:PFX_PASSWORD = 'SuClaveSegura'"
        exit 1
    }
}
```

### Cambios en `setup_pki.sh`

#### Antes:
```bash
# Password por defecto para desarrollo: Seguridad2026
PFX_DEFAULT_PASSWORD="Seguridad2026"  # ❌ INSEGURO
generate_judge_cert "10" "Juan Perez" "juan.perez@justice.ec" "$PFX_DEFAULT_PASSWORD"
```

#### Después:
```bash
# [SEGURIDAD S2068] Obtener contraseña de variable de entorno o argumento
if [ -z "$1" ]; then
    if [ -z "${PFX_PASSWORD}" ]; then
        echo "[ERROR] Falta la contraseña para los certificados PFX." >&2
        echo "Debe proporcionar la contraseña de una de las siguientes formas:"
        echo "  1. Como argumento: ./setup_pki.sh 'SuClaveSegura'"
        echo "  2. Como variable de entorno: export PFX_PASSWORD='SuClaveSegura'"
        exit 1
    fi
    PFX_PASSWORD_FINAL="${PFX_PASSWORD}"
else
    PFX_PASSWORD_FINAL="$1"
fi

generate_judge_cert "10" "Juan Perez" "juan.perez@justice.ec" "$PFX_PASSWORD_FINAL"
```

---

## Cómo Usar de Forma Segura

### Opción A: Variable de Entorno (RECOMENDADA PARA CI/CD)

**PowerShell (Windows):**
```powershell
$env:PFX_PASSWORD = "TuNuevaClaveUltraSegura_NoLaAnterior"
.\setup_pki.ps1
```

**Bash/Shell (Linux/Mac):**
```bash
export PFX_PASSWORD="TuNuevaClaveUltraSegura_NoLaAnterior"
./setup_pki.sh
```

### Opción B: Argumento Directo (Cuidado con el Historial)

**PowerShell:**
```powershell
.\setup_pki.ps1 -PfxPassword "TuNuevaClaveUltraSegura"
```

**Bash:**
```bash
./setup_pki.sh "TuNuevaClaveUltraSegura"
```

⚠️ **NOTA:** Con esta opción, la contraseña queda en el historial del terminal. Para máxima seguridad, usar la Opción A.

### Opción C: Docker Secrets (RECOMENDADA PARA PRODUCCIÓN)

```dockerfile
# Dockerfile
RUN --mount=type=secret,id=pfx_password \
    export PFX_PASSWORD=$(cat /run/secrets/pfx_password) && \
    ./setup_pki.sh
```

```bash
docker build --secret pfx_password=<valor> -t juez-seguro .
```

---

## Acciones Requeridas

### 1. **Regenerar Certificados** ⚠️

Dado que "Seguridad2026" estaba expuesta, todos los certificados anteriores deben considerarse comprometidos:

```bash
# Generar nueva contraseña (32+ caracteres)
openssl rand -base64 32

# Regenerar certificados con nueva contraseña
export PFX_PASSWORD="<nueva_contraseña_segura>"
./setup_pki.sh  # o .\setup_pki.ps1 en Windows
```

### 2. **Rotar Certificados en Producción**

- Emitir nuevos certificados para todos los jueces
- Distribuir de forma segura (no por email)
- Actualizar configuración de aplicaciones
- Revocar certificados antiguos

### 3. **Actualizar Documentación**

- Capacitar equipo sobre manejo de secretos
- Documentar procedimiento de generación en entornos
- Establecer políticas de rotación de credenciales

### 4. **Monitorear y Auditar**

- Revisar logs de acceso al repositorio
- Buscar usos de "Seguridad2026" en otros contextos
- Implementar secret scanning en CI/CD

---

## Validación de la Solución

### ✅ Cumplimientos

1. **No hay secrets en código:** Contraseña no aparece en archivos fuente
2. **Principio de Menor Privilegio:** Script requiere credencial para funcionar
3. **Fallo Seguro (Fail Fast):** Si no se proporciona contraseña, la ejecución se detiene
4. **Trazabilidad:** Logs indican de dónde se obtuvo la contraseña (variable de entorno vs argumento)
5. **Compatibilidad:** Funciona con CI/CD (GitHub Actions, Jenkins, etc.)

### 🔍 Verificación Manual

```bash
# Confirmar que la contraseña NO está en el archivo
grep -i "Seguridad2026" setup_pki.ps1
grep -i "Seguridad2026" setup_pki.sh
# Resultado esperado: sin coincidencias

# Confirmar que requiere contraseña
./setup_pki.ps1
# Resultado esperado: [ERROR] Falta la contraseña...
```

---

## Referencias

- **OWASP:** [A02:2021 – Cryptographic Failures](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)
- **CWE-798:** [Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html)
- **Sonar:** [S2068: Credentials should not be hard-coded](https://rules.sonarsource.com/java/type/Vulnerability/RSPEC-2068)
- **12 Factor App:** [Store config in environment](https://12factor.net/config)

---

## Conclusión

Esta mitigación elimina la exposición crítica de secretos en los scripts de configuración PKI, estableciendo un procedimiento seguro para la gestión de credenciales que es compatible con estándares de seguridad y CI/CD moderno.

**Última actualización:** 11 de Enero de 2026
