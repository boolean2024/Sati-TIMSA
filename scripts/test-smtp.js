require('dotenv').config();
const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 465);
const secure = process.env.SMTP_SECURE !== 'false';
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM || user;
const to = process.env.SMTP_TEST_TO || user;

if (!host || !user || !pass || !from || !to) {
  throw new Error('Faltan variables SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM o SMTP_TEST_TO.');
}

const isGmail = /(^|\.)gmail\.com$/i.test(host);
const transporter = nodemailer.createTransport({
  ...(isGmail ? { service: 'gmail' } : {}),
  host,
  port,
  secure,
  auth: { user, pass }
});

transporter.sendMail({
  from: `"SATI-TIMSA" <${from}>`,
  to,
  subject: 'Prueba SMTP SATI-TIMSA',
  html: '<p>Funciono. SMTP quedo integrado en SATI-TIMSA.</p>',
  text: 'Funciono. SMTP quedo integrado en SATI-TIMSA.'
}).then((info) => {
  console.log(`Correo enviado: ${info.messageId}`);
}).catch((error) => {
  console.error(error.response || error.message);
  process.exit(1);
});
