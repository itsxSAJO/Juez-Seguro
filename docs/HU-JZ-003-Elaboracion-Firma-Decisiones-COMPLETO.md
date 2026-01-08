# HU-JZ-003: Elaboración y Firma de Autos, Providencias y Sentencias

## 📋 Información General

| Campo | Valor |
|-------|-------|
| **ID** | HU-JZ-003 |
| **Nombre** | Elaboración y Firma Electrónica de Decisiones Judiciales |
| **Módulo** | Decisiones Judiciales y Firma PKI |
| **Sprint** | Sprint 3 |
| **Estado** | ✅ Implementado |
| **Prioridad** | 🔴 CRÍTICA |
| **Fecha Implementación** | 2026-01-08 |

## 🎯 Objetivo

Permitir a los jueces **elaborar, editar y firmar electrónicamente** autos, providencias y sentencias mediante certificados digitales PKI, garantizando la **inmutabilidad** de los documentos firmados y su vinculación automática al expediente electrónico de la causa.

## 📖 Historia de Usuario

**Como** Juez del Sistema Judicial  
**Quiero** poder redactar decisiones judiciales (autos, providencias y sentencias) y firmarlas electrónicamente con mi certificado digital  
**Para** garantizar la autenticidad, integridad y no repudio de las decisiones judiciales conforme a la Ley de Comercio Electrónico, Firmas y Mensajes de Datos del Ecuador

## 🔐 Requisitos de Seguridad Common Criteria

### FCS_COP.1 (Cryptographic Operation)
- ✅ **Algoritmo de firma**: SHA256withRSA (2048 bits mínimo)
- ✅ **Certificados X.509**: Almacenamiento seguro de claves
- ✅ **Hash de integridad**: SHA-256 para verificación de documentos

### FDP_ACC.1 (Subset Access Control)
- ✅ **Solo el juez autor puede firmar**: Verificación de propiedad
- ✅ **Inmutabilidad post-firma**: Triggers que bloquean modificaciones
- ✅ **Estados controlados**: BORRADOR → LISTA_PARA_FIRMA → FIRMADA

### FDP_ITC.1 (Import of User Data without Security Attributes)
- ✅ **Documento vinculado al expediente**: INSERT en tabla `documentos`
- ✅ **Metadatos de firma preservados**: Certificado, serial, algoritmo
- ✅ **Hash almacenado**: Verificación de integridad futura

### FAU_GEN.1 (Audit Data Generation)
- ✅ **Registro de firma**: Evento DECISION_FIRMADA con severidad CRÍTICA
- ✅ **Registro de intentos denegados**: Evento FIRMA_DENEGADA
- ✅ **Datos completos**: Hash, certificado, IP, timestamp

### FPT_ITI.1 (Inter-TSF Detection of Modification)
- ✅ **Verificación de integridad**: Comparación de hash almacenado vs calculado
- ✅ **Detección de manipulación**: Endpoint de verificación

## 🏗️ Arquitectura de la Solución

### Flujo de Firma Electrónica

```
┌─────────────────────────────────────────────────────────────┐
│                 JUEZ: CREAR DECISIÓN                         │
│        POST /api/decisiones + {titulo, tipo, contenido}     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│             DECISIÓN EN ESTADO: BORRADOR                     │
│  • Juez puede editar contenido                               │
│  • Se incrementa versión en cada cambio                      │
│  • Historial de cambios registrado                           │
└────────────────────┬────────────────────────────────────────┘
                     │ POST /api/decisiones/:id/preparar-firma
                     ▼
┌─────────────────────────────────────────────────────────────┐
│          DECISIÓN EN ESTADO: LISTA_PARA_FIRMA               │
│  • Contenido congelado (verificable antes de firmar)        │
│  • Verificación de certificado válido del juez              │
│  • Permite revisión final                                    │
└────────────────────┬────────────────────────────────────────┘
                     │ POST /api/decisiones/:id/firmar
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    PROCESO DE FIRMA                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. BEGIN TRANSACTION                                 │   │
│  │                                                      │   │
│  │ 2. Generar contenido final con pseudónimo del juez  │   │
│  │                                                      │   │
│  │ 3. Calcular hash SHA-256 del contenido              │   │
│  │                                                      │   │
│  │ 4. FIRMAR con certificado PKI del juez:             │   │
│  │    - Algoritmo: SHA256withRSA                       │   │
│  │    - Certificado X.509                              │   │
│  │    - Firma Base64                                   │   │
│  │                                                      │   │
│  │ 5. Generar PDF firmado con pdf-lib                  │   │
│  │                                                      │   │
│  │ 6. Almacenar PDF en filesystem seguro               │   │
│  │                                                      │   │
│  │ 7. INSERT documento en expediente electrónico       │   │
│  │    (tabla documentos con estado='firmado')          │   │
│  │                                                      │   │
│  │ 8. UPDATE decisión:                                 │   │
│  │    - estado = 'FIRMADA'                             │   │
│  │    - fecha_firma = NOW()                            │   │
│  │    - hash_integridad_pdf                            │   │
│  │    - certificado_firmante                           │   │
│  │    - numero_serie_certificado                       │   │
│  │    - algoritmo_firma                                │   │
│  │    - firma_base64                                   │   │
│  │    - documento_id (vinculación al expediente)       │   │
│  │                                                      │   │
│  │ 9. Si es SENTENCIA: UPDATE causa.estado='RESUELTA' │   │
│  │                                                      │   │
│  │ 10. COMMIT TRANSACTION                              │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           DECISIÓN EN ESTADO: FIRMADA (INMUTABLE)           │
│  • Documento vinculado al expediente electrónico            │
│  • Visible en línea de tiempo de la causa                   │
│  • Trigger bloquea cualquier modificación                   │
│  • Verificación de integridad disponible                    │
└─────────────────────────────────────────────────────────────┘
```

## 💻 Implementación Técnica

### 1. Servicio de Decisiones

**Archivo**: `backend/src/services/decisiones.service.ts`

#### Función Principal: `firmarDecision()`

```typescript
async firmarDecision(
  decisionId: number,
  usuario: ContextoUsuario,
  ipOrigen: string,
  userAgent: string
): Promise<DecisionJudicial> {
  const client = await casesPool.connect();
  try {
    // Iniciar transacción para atomicidad
    await client.query('BEGIN');

    // 1. Obtener la decisión con bloqueo
    const result = await client.query(
      `SELECT d.*, c.numero_proceso, c.juez_pseudonimo
       FROM decisiones_judiciales d
       JOIN causas c ON d.causa_id = c.causa_id
       WHERE d.decision_id = $1
       FOR UPDATE`,
      [decisionId]
    );

    const decision = this.mapearDecision(result.rows[0]);

    // 2. Verificar que el juez sea el autor
    if (decision.juezAutorId !== usuario.funcionarioId) {
      throw new Error("Solo el juez autor puede firmar esta decisión");
    }

    // 3. Verificar estado válido
    if (decision.estado === "FIRMADA") {
      throw new Error("Esta decisión ya está firmada");
    }

    // 4. Generar contenido final y hash
    const contenidoFinal = this.generarContenidoFinalDocumento(
      decision, numeroProceso, decision.juezPseudonimo
    );

    // 5. FIRMAR DIGITALMENTE
    const metadatosFirma = await firmaService.firmarDocumento(
      usuario.funcionarioId,
      contenidoFinal,
      ipOrigen,
      userAgent
    );

    // 6. Generar y almacenar PDF
    const pdfContent = await this.generarPdfReal(contenidoFinal, metadatosFirma);
    const hashFinal = firmaService.calcularHash(pdfContent);
    await fs.writeFile(rutaAbsoluta, pdfContent);

    // 7. Insertar documento en expediente electrónico
    const documentoResult = await client.query(
      `INSERT INTO documentos (
        id, causa_id, tipo, nombre, ruta, hash_integridad,
        tamanio_bytes, mime_type, subido_por_id, subido_por_nombre,
        fecha_subida, estado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'application/pdf', $8, $9, NOW(), 'firmado')
      RETURNING id`,
      [documentoUuid, decision.causaId, decision.tipoDecision.toLowerCase(),
       nombreArchivo, rutaRelativa, hashFinal, pdfContent.length,
       usuario.funcionarioId, decision.juezPseudonimo]
    );

    // 8. Actualizar decisión a FIRMADA
    await client.query(
      `UPDATE decisiones_judiciales SET
        estado = 'FIRMADA',
        fecha_firma = NOW(),
        ruta_pdf_firmado = $2,
        hash_integridad_pdf = $3,
        certificado_firmante = $4,
        numero_serie_certificado = $5,
        algoritmo_firma = $6,
        firma_base64 = $7,
        documento_id = $8
       WHERE decision_id = $1`,
      [decisionId, rutaRelativa, hashFinal, ...]
    );

    // 9. Actualizar estado de causa si es SENTENCIA
    if (decision.tipoDecision === 'SENTENCIA') {
      await client.query(
        `UPDATE causas SET estado_procesal = 'RESUELTA' WHERE causa_id = $1`,
        [decision.causaId]
      );
    }

    // 10. COMMIT transacción
    await client.query('COMMIT');

    // 11. Auditoría
    await auditService.log({
      tipoEvento: "DECISION_FIRMADA",
      descripcion: "[CRITICO] Decisión judicial firmada electrónicamente",
      // ...
    });

    return decisionFirmada;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### 2. Servicio de Firma PKI

**Archivo**: `backend/src/services/firma.service.ts`

```typescript
class FirmaService {
  private certificadoPath: string;
  private clavePrivadaPath: string;

  /**
   * Firma un documento con el certificado del juez
   */
  async firmarDocumento(
    funcionarioId: number,
    contenido: string | Buffer,
    ipOrigen: string,
    userAgent: string
  ): Promise<MetadatosFirma> {
    // 1. Cargar certificado del juez
    const certInfo = await this.cargarCertificadoJuez(funcionarioId);

    // 2. Calcular hash del contenido
    const hash = this.calcularHash(contenido);

    // 3. Firmar con la clave privada
    const sign = crypto.createSign('SHA256');
    sign.update(typeof contenido === 'string' ? contenido : contenido.toString());
    sign.end();
    
    const firmaBase64 = sign.sign(certInfo.clavePrivada, 'base64');

    return {
      firmaBase64,
      algoritmoFirma: 'SHA256withRSA',
      certificadoFirmante: certInfo.nombreFirmante,
      numeroSerieCertificado: certInfo.numeroSerie,
      hashDocumento: hash,
      fechaFirma: new Date(),
    };
  }

  /**
   * Calcula hash SHA-256 de un contenido
   */
  calcularHash(contenido: string | Buffer): string {
    return crypto
      .createHash('sha256')
      .update(contenido)
      .digest('hex');
  }

  /**
   * Verifica una firma digital
   */
  async verificarFirma(
    contenido: Buffer,
    firmaBase64: string,
    certificadoPublico: string
  ): Promise<boolean> {
    const verify = crypto.createVerify('SHA256');
    verify.update(contenido);
    verify.end();
    
    return verify.verify(certificadoPublico, firmaBase64, 'base64');
  }
}
```

### 3. Generación de PDF

**Función**: `generarPdfReal()`

```typescript
private async generarPdfReal(
  contenido: string,
  firma: MetadatosFirma
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Escribir contenido del documento
  // ...código de renderizado...

  // Cuadro de firma electrónica
  page.drawRectangle({
    x: margin,
    y: yPosition - 70,
    width: maxWidth,
    height: 70,
    borderColor: rgb(0.2, 0.5, 0.2),
    borderWidth: 1,
  });
  
  page.drawText('FIRMADO ELECTRÓNICAMENTE', {
    x: margin + 10,
    y: yPosition - 20,
    size: 11,
    font: helveticaBold,
    color: rgb(0.2, 0.5, 0.2),
  });
  
  page.drawText(`Por: ${firma.certificadoFirmante}`, {
    x: margin + 10,
    y: yPosition - 38,
    size: 9,
    font: helvetica,
  });
  
  page.drawText('Conforme a la Ley de Comercio Electrónico...', {
    x: margin + 10,
    y: yPosition - 54,
    size: 8,
    font: helvetica,
  });

  return Buffer.from(await pdfDoc.save());
}
```

### 4. Trigger de Inmutabilidad

**SQL**: `scripts/casos_sprint2/01_schema.sql`

```sql
CREATE OR REPLACE FUNCTION bloquear_modificacion_firmados()
RETURNS TRIGGER AS $$
BEGIN
    -- Bloquear modificaciones a documentos firmados
    IF OLD.estado = 'FIRMADA' THEN
        -- Permitir solo cambio a ANULADA (proceso judicial especial)
        IF TG_OP = 'UPDATE' AND NEW.estado = 'ANULADA' THEN
            RAISE NOTICE 'Anulación de decisión firmada ID: %', OLD.decision_id;
            RETURN NEW;
        END IF;
        
        RAISE EXCEPTION 'SEGURIDAD: No se puede modificar una decisión firmada (ID: %). Las decisiones firmadas son inmutables.'
            USING ERRCODE = 'restrict_violation';
    END IF;
    
    -- Incrementar versión en borradores
    IF TG_OP = 'UPDATE' AND OLD.estado = 'BORRADOR' AND NEW.estado = 'BORRADOR' THEN
        NEW.version := OLD.version + 1;
    END IF;
    
    NEW.fecha_actualizacion := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inmutabilidad_decisiones_update
    BEFORE UPDATE ON decisiones_judiciales
    FOR EACH ROW
    EXECUTE FUNCTION bloquear_modificacion_firmados();
```

## 🛡️ Endpoints de la API

### Decisiones

| Ruta | Método | Descripción | Auth |
|------|--------|-------------|------|
| `/api/decisiones` | GET | Listar decisiones del juez | JUEZ |
| `/api/decisiones` | POST | Crear nueva decisión | JUEZ |
| `/api/decisiones/:id` | GET | Obtener decisión por ID | JUEZ (propietario) |
| `/api/decisiones/:id` | PUT | Actualizar borrador | JUEZ (propietario) |
| `/api/decisiones/:id/preparar-firma` | POST | Cambiar a LISTA_PARA_FIRMA | JUEZ (propietario) |
| `/api/decisiones/:id/firmar` | POST | **Firmar electrónicamente** | JUEZ (propietario) |
| `/api/decisiones/:id/verificar` | GET | Verificar integridad | Público |
| `/api/decisiones/:id/pdf` | GET | Descargar PDF firmado | JUEZ |

### Respuesta de Firma Exitosa

```json
{
  "success": true,
  "data": {
    "decision": {
      "decisionId": 2,
      "causaId": 9,
      "juezAutorId": 8,
      "juezPseudonimo": "JUEZ-AED59BE4",
      "tipoDecision": "SENTENCIA",
      "titulo": "SENTENCIA - 17254-2026-00001",
      "estado": "FIRMADA",
      "fechaFirma": "2026-01-08T06:08:28.612Z",
      "hashIntegridadPdf": "864731c2383cb4835cd8...",
      "documentoId": "dec-2-1767852508704"
    },
    "mensaje": "Decisión firmada electrónicamente y vinculada al expediente",
    "firmaInfo": {
      "hash": "864731c2383cb4835cd8...",
      "algoritmo": "SHA256withRSA",
      "certificado": "Juez Asignado Sistema",
      "fechaFirma": "2026-01-08T06:08:28.612Z",
      "numeroSerie": "067FFC0E36584BFA..."
    },
    "pdfUrl": "/api/decisiones/2/pdf"
  }
}
```

## 📊 Modelo de Datos

### Tabla: `decisiones_judiciales`

```sql
CREATE TABLE decisiones_judiciales (
    decision_id SERIAL PRIMARY KEY,
    causa_id INTEGER NOT NULL REFERENCES causas(causa_id),
    juez_autor_id INTEGER NOT NULL,
    juez_pseudonimo VARCHAR(50) NOT NULL,
    tipo_decision VARCHAR(50) NOT NULL CHECK (
        tipo_decision IN ('AUTO', 'PROVIDENCIA', 'SENTENCIA')
    ),
    titulo VARCHAR(500) NOT NULL,
    contenido_borrador TEXT,
    estado VARCHAR(30) NOT NULL DEFAULT 'BORRADOR' CHECK (
        estado IN ('BORRADOR', 'LISTA_PARA_FIRMA', 'FIRMADA', 'ANULADA')
    ),
    
    -- Campos de firma (poblados al firmar)
    fecha_firma TIMESTAMPTZ,
    ruta_pdf_firmado VARCHAR(500),
    hash_integridad_pdf CHAR(64),
    certificado_firmante VARCHAR(500),
    numero_serie_certificado VARCHAR(100),
    algoritmo_firma VARCHAR(50),
    firma_base64 TEXT,
    documento_id VARCHAR(50) REFERENCES documentos(id),
    
    -- Auditoría
    version INTEGER NOT NULL DEFAULT 1,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    ip_creacion VARCHAR(45),
    
    -- Constraint: Si está FIRMADA, debe tener todos los datos de firma
    CONSTRAINT chk_firma_completa CHECK (
        estado <> 'FIRMADA' OR (
            estado = 'FIRMADA' AND 
            fecha_firma IS NOT NULL AND 
            hash_integridad_pdf IS NOT NULL
        )
    )
);
```

### Vinculación con Expediente Electrónico

Cuando una decisión se firma:

1. **Se crea un registro en `documentos`**:
   - `id`: UUID único (ej: `dec-2-1767852508704`)
   - `causa_id`: Causa a la que pertenece
   - `tipo`: 'sentencia', 'auto' o 'providencia'
   - `estado`: 'firmado'
   - `subido_por_nombre`: Pseudónimo del juez

2. **Se actualiza `decisiones_judiciales`**:
   - `documento_id`: Referencia al documento
   - `estado`: 'FIRMADA'

3. **Resultado**: El documento aparece automáticamente en:
   - Expediente electrónico de la causa
   - Pestaña de documentos
   - Línea de tiempo

## 🧪 Casos de Prueba

### Caso 1: Firma Exitosa ✅

**Precondiciones**:
- Juez con ID 8 tiene decisión ID 2 en estado LISTA_PARA_FIRMA
- Juez tiene certificado digital válido

**Pasos**:
1. POST `/api/decisiones/2/firmar`
2. Sistema verifica propiedad (juez_autor_id = 8)
3. Sistema genera PDF con contenido
4. Sistema firma con SHA256withRSA
5. Sistema inserta documento en expediente
6. Sistema actualiza decisión a FIRMADA
7. Sistema hace COMMIT

**Resultado esperado**:
- Estado: FIRMADA
- documento_id vinculado
- PDF almacenado en filesystem
- Documento visible en expediente electrónico

### Caso 2: Intento de Modificar Decisión Firmada ❌

**Precondiciones**:
- Decisión ID 1 está FIRMADA

**Pasos**:
1. PUT `/api/decisiones/1` con nuevo contenido

**Resultado esperado**:
- Error 400: "No se puede modificar una decisión firmada"
- Trigger bloquea el UPDATE

### Caso 3: Juez No Propietario Intenta Firmar ❌

**Precondiciones**:
- Decisión ID 2 pertenece a Juez 8
- Juez 5 intenta firmar

**Pasos**:
1. Juez 5 hace POST `/api/decisiones/2/firmar`

**Resultado esperado**:
- Error 403: "Solo el juez autor puede firmar esta decisión"
- Evento FIRMA_DENEGADA en auditoría

## 📝 Auditoría

### Evento: DECISION_FIRMADA

```json
{
  "tipo_evento": "DECISION_FIRMADA",
  "descripcion": "[CRITICO] Decisión judicial firmada electrónicamente y vinculada al expediente",
  "datos_afectados": {
    "decisionId": 2,
    "causaId": 9,
    "numeroProceso": "17254-2026-00001",
    "tipoDecision": "SENTENCIA",
    "titulo": "SENTENCIA - 17254-2026-00001",
    "hashDocumento": "864731c2383cb4835cd8...",
    "certificadoFirmante": "Juez Asignado Sistema",
    "serialCertificado": "067FFC0E36584BFA...",
    "algoritmo": "SHA256withRSA",
    "rutaPdf": "9/SENTENCIA_2_1767852508704.pdf",
    "documentoId": "dec-2-1767852508704",
    "vinculadoExpediente": true,
    "estadoCausaActualizado": true
  }
}
```

### Evento: FIRMA_DENEGADA

```json
{
  "tipo_evento": "FIRMA_DENEGADA",
  "descripcion": "[ALTA] Intento de firmar decisión de otro juez",
  "datos_afectados": {
    "decisionId": 2,
    "juezAutor": 8,
    "juezIntentando": 5
  }
}
```

## 🔧 Configuración y Despliegue

### Variables de Entorno

```env
# Ruta de almacenamiento de PDFs firmados
DECISIONES_STORAGE_PATH=./secure_docs_storage

# Ruta de certificados PKI
CERTIFICATES_PATH=./certificates
```

### Estructura de Almacenamiento

```
secure_docs_storage/
├── 9/                              # causa_id
│   ├── SENTENCIA_2_1767852508704.pdf
│   └── AUTO_3_1767853000000.pdf
├── 10/
│   └── PROVIDENCIA_5_1767854000000.pdf
```

### Certificados PKI

```
certificates/
├── juez_8/
│   ├── certificate.pem      # Certificado X.509
│   └── private_key.pem      # Clave privada (protegida)
```

## ✅ Criterios de Aceptación

| Criterio | Estado |
|----------|--------|
| Juez puede crear decisiones en borrador | ✅ |
| Juez puede editar decisiones en borrador | ✅ |
| Solo el juez autor puede firmar | ✅ |
| Firma usa SHA256withRSA | ✅ |
| PDF se genera correctamente | ✅ |
| Documento se vincula al expediente | ✅ |
| Decisión firmada es inmutable | ✅ |
| SENTENCIA actualiza estado de causa | ✅ |
| Pseudónimo del juez en documento | ✅ |
| Auditoría completa de firmas | ✅ |
| Verificación de integridad disponible | ✅ |

## 📚 Referencias

- **Ley de Comercio Electrónico, Firmas y Mensajes de Datos del Ecuador**
- **Common Criteria ISO/IEC 15408**
  - FCS_COP.1: Cryptographic Operation
  - FDP_ACC.1: Subset Access Control
  - FAU_GEN.1: Audit Data Generation
- **NIST SP 800-57**: Recommendation for Key Management
- **RFC 5280**: X.509 PKI Certificate Profile
