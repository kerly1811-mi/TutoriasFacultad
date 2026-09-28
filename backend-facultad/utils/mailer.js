const nodemailer = require('nodemailer');

function obtenerTransporter() {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  if (process.env.EMAIL_HOST) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true' || Number(process.env.EMAIL_PORT) === 465,
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: { user, pass },
  });
}

/**
 * Envía credenciales de acceso a un usuario recién creado por el administrador.
 */
async function enviarCredencialesNuevoUsuario({ correo, nombres, rol, password }) {
  const transporter = obtenerTransporter();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const remitente = process.env.EMAIL_FROM || `"Sistema de Tutorías y Laboratorios" <${process.env.EMAIL_USER || 'no-reply@facultad.edu'}>`;

  if (!transporter) {
    console.warn(`[MAILER] SMTP no configurado (EMAIL_USER / EMAIL_PASS no definidos en .env). Credenciales para ${correo}: Password=${password}`);
    return { enviado: false, motivo: 'SMTP_NO_CONFIGURADO' };
  }

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Sistema de Tutorías y Espacios</h1>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Facultad de Ingeniería</p>
      </div>

      <div style="padding: 28px 24px; color: #1e293b;">
        <h2 style="margin: 0 0 16px; font-size: 18px; color: #0f172a;">Hola, ${nombres}</h2>
        <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #475569;">
          Un administrador ha creado tu cuenta institucional para acceder a la plataforma. A continuación se detallan tus credenciales de acceso:
        </p>

        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Rol asignado:</strong></td>
              <td style="padding: 6px 0; color: #1e293b;"><span style="background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 12px;">${rol}</span></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Usuario / Correo:</strong></td>
              <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-size: 15px;">${correo}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Contraseña inicial:</strong></td>
              <td style="padding: 6px 0; color: #b91c1c; font-family: monospace; font-size: 16px; font-weight: bold;">${password}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${frontendUrl}/login" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">
            Iniciar Sesión en la Plataforma
          </a>
        </div>

        <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          <strong>Recomendación de seguridad:</strong> Te sugerimos cambiar tu contraseña una vez que hayas iniciado sesión.
        </p>
      </div>

      <div style="background: #f8fafc; padding: 14px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        Sistema de Tutorías y Gestión de Espacios Académicos.
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: remitente,
      to: correo,
      subject: 'Tus credenciales de acceso al Sistema de Tutorías',
      text: `Hola ${nombres},\n\nUn administrador ha creado tu cuenta con el rol ${rol}.\nUsuario: ${correo}\nContraseña: ${password}\n\nIngresa en: ${frontendUrl}/login`,
      html,
    });
    console.log(`[MAILER] Credenciales enviadas a ${correo} (ID: ${info.messageId})`);
    return { enviado: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[MAILER ERROR] Error al enviar credenciales a ${correo}:`, error.message);
    return { enviado: false, error: error.message };
  }
}

/**
 * Envía el enlace y token de recuperación de contraseña.
 */
async function enviarRecuperacionPassword({ correo, nombres, token, resetUrl }) {
  const transporter = obtenerTransporter();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const urlFinal = resetUrl || `${frontendUrl}/recuperar-password?token=${token}`;
  const remitente = process.env.EMAIL_FROM || `"Sistema de Tutorías y Laboratorios" <${process.env.EMAIL_USER || 'no-reply@facultad.edu'}>`;

  if (!transporter) {
    console.warn(`[MAILER] SMTP no configurado. Token de recuperación para ${correo}: ${token}\nEnlace: ${urlFinal}`);
    return { enviado: false, motivo: 'SMTP_NO_CONFIGURADO', url: urlFinal };
  }

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Recuperación de Contraseña</h1>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Sistema de Tutorías y Espacios</p>
      </div>

      <div style="padding: 28px 24px; color: #1e293b;">
        <h2 style="margin: 0 0 16px; font-size: 18px; color: #0f172a;">Hola, ${nombres}</h2>
        <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #475569;">
          Hemos recibido una solicitud para restablecer la contraseña de tu cuenta (<strong>${correo}</strong>).
        </p>

        <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #475569;">
          Haz clic en el siguiente botón para crear una nueva contraseña. Este enlace es válido durante <strong>15 minutos</strong>:
        </p>

        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${urlFinal}" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">
            Restablecer mi Contraseña
          </a>
        </div>

        <p style="margin: 0 0 8px; font-size: 12px; color: #64748b;">
          O copia y pega este enlace en tu navegador:
        </p>
        <p style="margin: 0 0 24px; font-size: 12px; color: #2563eb; word-break: break-all;">
          ${urlFinal}
        </p>

        <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          Si tú no solicitaste este cambio, puedes ignorar este correo de forma segura. Tu contraseña actual permanecerá intacta.
        </p>
      </div>

      <div style="background: #f8fafc; padding: 14px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        Sistema de Tutorías y Gestión de Espacios Académicos.
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: remitente,
      to: correo,
      subject: 'Recuperación de contraseña - Sistema de Tutorías',
      text: `Hola ${nombres},\n\nHemos recibido una solicitud para restablecer tu contraseña.\nAbre este enlace (válido 15 min):\n${urlFinal}\n\nSi no lo solicitaste, ignora este mensaje.`,
      html,
    });
    console.log(`[MAILER] Recuperación enviada a ${correo} (ID: ${info.messageId})`);
    return { enviado: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[MAILER ERROR] Error al enviar recuperación a ${correo}:`, error.message);
    return { enviado: false, error: error.message };
  }
}

module.exports = {
  enviarCredencialesNuevoUsuario,
  enviarRecuperacionPassword,
};
