// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Correo Electrónico
// Envío de notificaciones y credenciales por email
// ============================================================================

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { secretsManager } from "./secrets-manager.service";

// ============================================================================
// CONFIGURACIÓN PARA ENTORNO EDUCATIVO
// En producción real, los correos irían al destinatario real.
// En este proyecto educativo, redirigimos a correos de prueba.
// ============================================================================

/**
 * Modo educativo: redirige correos institucionales a correos de prueba
 * Esto permite probar el sistema sin cuentas institucionales reales
 */
const EMAIL_EDUCATIVO_HABILITADO = process.env.EMAIL_MODO_EDUCATIVO === "true";

// Correos de prueba para el entorno educativo
const CORREOS_PRUEBA = {
  JUEZ: "juez.jz15@gmail.com",
  SECRETARIA: "secretaria.juez20@gmail.com",
  DEFAULT: "juez.jz15@gmail.com", // Fallback para otros roles
};

/**
 * Determina el correo real de destino según el rol del usuario
 * En modo educativo, redirige a los correos de prueba
 */
const obtenerCorreoDestino = (
  correoOriginal: string,
  rolUsuario?: "JUEZ" | "SECRETARIO" | "ADMIN"
): string => {
  if (!EMAIL_EDUCATIVO_HABILITADO) {
    return correoOriginal;
  }

  // En modo educativo, redirigir según el rol
  switch (rolUsuario) {
    case "JUEZ":
      return CORREOS_PRUEBA.JUEZ;
    case "SECRETARIO":
      return CORREOS_PRUEBA.SECRETARIA;
    case "ADMIN":
      return CORREOS_PRUEBA.DEFAULT;
    default:
      // Si no hay rol, intentar inferir del correo
      if (correoOriginal.toLowerCase().includes("juez")) {
        return CORREOS_PRUEBA.JUEZ;
      } else if (correoOriginal.toLowerCase().includes("secretari")) {
        return CORREOS_PRUEBA.SECRETARIA;
      }
      return CORREOS_PRUEBA.DEFAULT;
  }
};

// Configuración del transporter según el entorno
const createTransporter = (): Transporter => {
  // Intentar obtener credenciales desde SecretsManager
  const smtpUser = secretsManager.getSecret("SMTP_USER");
  const smtpPass = secretsManager.getSecret("SMTP_PASSWORD");

  if (smtpUser && smtpPass) {
    console.log("📧 SMTP configurado con credenciales desde db_secrets");
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false, // Gmail usa STARTTLS en puerto 587
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  // Fallback: usar variables de entorno (desarrollo)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log("📧 SMTP configurado con variables de entorno");
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Sin credenciales, crear un transporter de prueba que solo loguea
  console.log("📧 SMTP no configurado - modo simulación (solo logs)");
  return nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
  });
};

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

/**
 * Reinicia el transporter (útil después de cargar secretos)
 */
export const reiniciarTransporter = (): void => {
  transporter = null;
  console.log("📧 Transporter SMTP reiniciado");
};

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  rolDestinatario?: "JUEZ" | "SECRETARIO" | "ADMIN";
}

/**
 * Servicio de Email
 * Cumple con FIA_UAU.2 - Notificación segura de credenciales
 */
class EmailService {
  private fromAddress: string;
  private fromName: string;

  constructor() {
    this.fromAddress =
      process.env.SMTP_FROM || "consejo.judicatura20@gmail.com";
    this.fromName = process.env.SMTP_FROM_NAME || "Sistema Juez Seguro";
  }

  /**
   * Verifica si SMTP está configurado
   */
  isConfigured(): boolean {
    const smtpUser = secretsManager.getSecret("SMTP_USER");
    return !!(smtpUser || process.env.SMTP_USER);
  }

  /**
   * Envía un correo electrónico
   */
  async send(options: EmailOptions): Promise<boolean> {
    try {
      const transport = getTransporter();

      // En modo educativo, redirigir al correo de prueba correspondiente
      const correoDestino = obtenerCorreoDestino(
        options.to,
        options.rolDestinatario
      );

      const mailOptions = {
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: correoDestino,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
      };

      // Verificar si tenemos SMTP configurado
      const smtpUser = secretsManager.getSecret("SMTP_USER");
      const tieneSmtp = !!(smtpUser || process.env.SMTP_USER);

      if (!tieneSmtp) {
        // Sin SMTP configurado, mostrar en consola
        console.log("\n" + "=".repeat(60));
        console.log("📧 CORREO (modo desarrollo - no enviado realmente)");
        console.log("=".repeat(60));
        console.log(`Para: ${options.to}`);
        if (EMAIL_EDUCATIVO_HABILITADO && correoDestino !== options.to) {
          console.log(`(Redirigido a: ${correoDestino})`);
        }
        console.log(`Asunto: ${options.subject}`);
        console.log("-".repeat(60));
        console.log(options.text || this.htmlToText(options.html));
        console.log("=".repeat(60) + "\n");
        return true;
      }

      // Enviar correo real
      const info = await transport.sendMail(mailOptions);

      console.log(`✅ Correo enviado exitosamente`);
      console.log(`   📬 Destinatario original: ${options.to}`);
      if (EMAIL_EDUCATIVO_HABILITADO && correoDestino !== options.to) {
        console.log(`   🔄 Redirigido a (modo educativo): ${correoDestino}`);
      }
      console.log(`   📨 Message ID: ${info.messageId}`);

      return true;
    } catch (error) {
      console.error("❌ Error al enviar correo:", error);
      return false;
    }
  }

  /**
   * Envía las credenciales de acceso a un nuevo funcionario
   */
  async enviarCredenciales(
    correo: string,
    nombreCompleto: string,
    passwordTemporal: string,
    rolUsuario?: "JUEZ" | "SECRETARIO" | "ADMIN"
  ): Promise<boolean> {
    // Determinar correo de destino (modo educativo)
    const correoDestino = obtenerCorreoDestino(correo, rolUsuario);
    const modoEducativo =
      EMAIL_EDUCATIVO_HABILITADO && correoDestino !== correo;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credenciales de Acceso - Juez Seguro</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">⚖️ Sistema Juez Seguro</h1>
    <p style="color: #a3c4dc; margin: 10px 0 0 0;">Consejo de la Judicatura</p>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    ${
      modoEducativo
        ? `
    <div style="background: #e7f3ff; border: 1px solid #b6d4fe; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
      <strong style="color: #084298;">🎓 Modo Educativo</strong>
      <p style="margin: 5px 0 0 0; color: #084298; font-size: 14px;">
        Este correo fue redirigido. Originalmente destinado a: <strong>${correo}</strong>
      </p>
    </div>
    `
        : ""
    }
    <h2 style="color: #1e3a5f; margin-top: 0;">Bienvenido/a al Sistema</h2>
    
    <p>Estimado/a <strong>${nombreCompleto}</strong>,</p>
    
    <p>Se ha creado su cuenta en el Sistema Juez Seguro. A continuación, encontrará sus credenciales de acceso:</p>
    
    <div style="background: white; border: 2px solid #1e3a5f; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666; width: 40%;">📧 Correo:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">${correo}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #666;">🔐 Contraseña temporal:</td>
          <td style="padding: 10px 0; font-weight: bold; font-family: monospace; font-size: 16px; color: #d63384;">${passwordTemporal}</td>
        </tr>
      </table>
    </div>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <strong style="color: #856404;">⚠️ Importante:</strong>
      <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #856404;">
        <li>Esta contraseña es temporal y deberá cambiarla en su primer inicio de sesión.</li>
        <li>No comparta estas credenciales con nadie.</li>
        <li>Si no solicitó esta cuenta, contacte al administrador inmediatamente.</li>
      </ul>
    </div>
    
    <p>Para acceder al sistema, visite:</p>
    <p style="text-align: center;">
      <a href="${process.env.FRONTEND_URL || "http://localhost:8080"}/funcionarios/login" 
         style="display: inline-block; background: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Iniciar Sesión
      </a>
    </p>
  </div>
  
  <div style="background: #1e3a5f; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
    <p style="color: #a3c4dc; margin: 0; font-size: 12px;">
      Este es un correo automático del Sistema Juez Seguro.<br>
      Por favor no responda a este mensaje.
    </p>
    <p style="color: #6c8faf; margin: 10px 0 0 0; font-size: 11px;">
      © ${new Date().getFullYear()} Consejo de la Judicatura - Todos los derechos reservados
    </p>
  </div>
</body>
</html>`;

    return this.send({
      to: correo,
      subject: "🔐 Credenciales de Acceso - Sistema Juez Seguro",
      html,
      rolDestinatario: rolUsuario,
    });
  }

  /**
   * Envía notificación de restablecimiento de contraseña
   */
  async enviarResetPassword(
    correo: string,
    nombreCompleto: string,
    nuevaPassword: string,
    rolUsuario?: "JUEZ" | "SECRETARIO" | "ADMIN"
  ): Promise<boolean> {
    // Determinar correo de destino (modo educativo)
    const correoDestino = obtenerCorreoDestino(correo, rolUsuario);
    const modoEducativo =
      EMAIL_EDUCATIVO_HABILITADO && correoDestino !== correo;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Restablecimiento de Contraseña - Juez Seguro</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">⚖️ Sistema Juez Seguro</h1>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    ${
      modoEducativo
        ? `
    <div style="background: #e7f3ff; border: 1px solid #b6d4fe; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
      <strong style="color: #084298;">🎓 Modo Educativo</strong>
      <p style="margin: 5px 0 0 0; color: #084298; font-size: 14px;">
        Este correo fue redirigido. Originalmente destinado a: <strong>${correo}</strong>
      </p>
    </div>
    `
        : ""
    }
    <h2 style="color: #1e3a5f; margin-top: 0;">Restablecimiento de Contraseña</h2>
    
    <p>Estimado/a <strong>${nombreCompleto}</strong>,</p>
    
    <p>Se ha restablecido la contraseña de su cuenta. Su nueva contraseña temporal es:</p>
    
    <div style="background: white; border: 2px solid #1e3a5f; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <span style="font-family: monospace; font-size: 20px; color: #d63384; letter-spacing: 2px;">${nuevaPassword}</span>
    </div>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <strong style="color: #856404;">⚠️ Por seguridad:</strong>
      <p style="margin: 10px 0 0 0; color: #856404;">
        Deberá cambiar esta contraseña en su próximo inicio de sesión.
      </p>
    </div>
  </div>
  
  <div style="background: #1e3a5f; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
    <p style="color: #a3c4dc; margin: 0; font-size: 12px;">
      Este es un correo automático del Sistema Juez Seguro.
    </p>
  </div>
</body>
</html>`;

    return this.send({
      to: correo,
      subject: "🔑 Restablecimiento de Contraseña - Sistema Juez Seguro",
      html,
      rolDestinatario: rolUsuario,
    });
  }

  /**
   * Convierte HTML a texto plano (básico)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*<\/style>/gi, "")
      .replace(/<script[^>]*>.*<\/script>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
}

export const emailService = new EmailService();
export default emailService;
