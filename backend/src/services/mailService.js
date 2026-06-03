const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

function canSendMail() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.smtpFrom);
}

function transporterOptions() {
  const isGmail = /(^|\.)gmail\.com$/i.test(env.smtpHost);
  return {
    ...(isGmail ? { service: 'gmail' } : {}),
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    }
  };
}

function resetEmailContent(code, resetUrl) {
  const button = resetUrl
    ? `<p style="margin:28px 0 10px"><a href="${resetUrl}" style="display:inline-block;background:#082b59;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:700">Clic Aqu&iacute;</a></p>`
    : '';

  return {
    subject: 'Codigo de recuperacion SATI-TIMSA',
    text: `Este es tu codigo de recuperacion para reestablecer tu contrasena: ${code}. Expira en 10 minutos.${resetUrl ? ` Abrir SATI-TIMSA: ${resetUrl}` : ''}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;max-width:560px;margin:0 auto;padding:24px;text-align:center">
        <img src="cid:timsa-logo" alt="Hutchison Ports TIMSA" style="width:210px;max-width:80%;height:auto;margin:0 auto 22px;display:block">
        <p style="font-size:17px;margin:0 0 18px">Este es tu codigo de recuperacion para reestablecer tu contrasena</p>
        <p style="font-size:34px;font-weight:700;letter-spacing:6px;margin:0;color:#082b59">${code}</p>
        ${button}
        <p style="font-size:13px;color:#64748b;margin-top:20px">El codigo expira en 10 minutos. Si no solicitaste este cambio, ignora este correo.</p>
      </div>
    `
  };
}

function emailAttachments() {
  const logoPath = path.resolve(process.cwd(), 'frontend', 'assets', 'img', 'hutchison_ports_timsa_logo.jpg');
  if (!fs.existsSync(logoPath)) {
    return [];
  }
  return [{
    filename: 'hutchison_ports_timsa_logo.jpg',
    path: logoPath,
    cid: 'timsa-logo'
  }];
}

async function sendPasswordResetCode(to, code, resetUrl = '') {
  if (!canSendMail()) {
    return {
      sent: false,
      reason: 'Correo SMTP no configurado. Configure SMTP_HOST, SMTP_USER, SMTP_PASS y SMTP_FROM en Vercel.'
    };
  }

  const content = resetEmailContent(code, resetUrl);
  const transporter = nodemailer.createTransport(transporterOptions());

  try {
    await transporter.sendMail({
      from: `"SATI-TIMSA" <${env.smtpFrom}>`,
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
      attachments: emailAttachments()
    });
    return { sent: true, provider: 'smtp' };
  } catch (error) {
    console.error('SMTP password reset error:', {
      code: error.code,
      responseCode: error.responseCode
    });
    return {
      sent: false,
      reason: error.responseCode === 535
        ? 'Autenticacion SMTP fallida. Verifique las credenciales.'
        : 'No se pudo enviar el correo. Verifique la configuracion SMTP.'
    };
  }
}

module.exports = { sendPasswordResetCode };
