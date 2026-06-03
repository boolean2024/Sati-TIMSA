const express = require('express');
const net = require('net');
const { authenticate, requireWriteAccess } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

const printSchema = z.object({
  zpl: z.string().min(10),
  printerIP: z.string().ip({ version: 'v4' })
});

router.post('/zpl', authenticate, requireWriteAccess, async (req, res, next) => {
  try {
    const { zpl, printerIP } = printSchema.parse(req.body);

    await new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = 8000;

      socket.setTimeout(timeout);

      socket.connect(9100, printerIP, () => {
        socket.write(zpl, 'utf8', (err) => {
          if (err) {
            socket.destroy();
            reject(new Error('Error enviando datos a la impresora.'));
            return;
          }
          socket.end();
          resolve();
        });
      });

      socket.on('error', (err) => {
        reject(new Error(`No se pudo conectar con la impresora en ${printerIP}:9100. Verifique la IP y que la impresora este encendida.`));
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(`Tiempo de espera agotado al conectar con ${printerIP}:9100.`));
      });
    });

    res.json({ message: 'Etiqueta enviada a la impresora.' });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de impresion invalidos.' });
    }
    if (error.message?.includes('impresora') || error.message?.includes('conectar') || error.message?.includes('Tiempo')) {
      return res.status(502).json({ message: error.message });
    }
    next(error);
  }
});

module.exports = router;