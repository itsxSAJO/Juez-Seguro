// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Correo Electrónico
// Envío de notificaciones y credenciales por email
// ============================================================================

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// Configuración del transporter según el entorno
const createTransporter = (): Transporter => {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    // Configuración para producción (SMTP real)
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true", // true para 465, false para otros
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Para desarrollo, usar Ethereal (correos de prueba)
    // O si hay credenciales configuradas, usarlas
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
    
    // Sin credenciales, crear un transporter de prueba que solo loguea
    return nodemailer.createTransport({
      streamTransport: true,
      newline: "unix",
    });
  }
};

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Servicio de Email
 */
class EmailService {
  private fromAddress: string;
  private fromName: string;

  constructor() {
    this.fromAddress = process.env.SMTP_FROM || "noreply@judicatura.gob.ec";
    this.fromName = process.env.SMTP_FROM_NAME || "Sistema Juez Seguro";
  }

  /**
   * Envía un correo electrónico
   */
  async send(options: EmailOptions): Promise<boolean> {
    try {
      const transport = getTransporter();
      
      const mailOptions = {
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
      };

      const info = await transport.sendMail(mailOptions);

      // En desarrollo sin SMTP configurado, mostrar en consola
      if (!process.env.SMTP_USER) {
        console.log("\n" + "=".repeat(60));
        console.log("📧 CORREO (modo desarrollo - no enviado realmente)");
        console.log("=".repeat(60));
        console.log(`Para: ${options.to}`);
        console.log(`Asunto: ${options.subject}`);
        console.log("-".repeat(60));
        console.log(options.text || this.htmlToText(options.html));
        console.log("=".repeat(60) + "\n");
      } else {
        console.log(`✅ Correo enviado a ${options.to}: ${info.messageId}`);
      }

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
    passwordTemporal: string
  ): Promise<boolean> {
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
      <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/funcionarios/login" 
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
    });
  }

  /**
   * Envía notificación de restablecimiento de contraseña
   */
  async enviarResetPassword(
    correo: string,
    nombreCompleto: string,
    nuevaPassword: string
  ): Promise<boolean> {
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
