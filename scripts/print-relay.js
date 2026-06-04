const express = require('express');
const net = require('net');
const app = express();

app.use(require('cors')());
app.use(express.json({ limit: '1mb' }));

app.post('/api/print/zpl', (req, res) => {
  const { zpl, printerIP } = req.body || {};
  if (!zpl || zpl.length < 10) {
    return res.status(400).json({ message: 'ZPL invalido o muy corto.' });
  }
  if (!printerIP) {
    return res.status(400).json({ message: 'IP de impresora requerida.' });
  }

  const socket = new net.Socket();
  const timeout = 8000;
  socket.setTimeout(timeout);

  socket.connect(9100, printerIP, () => {
    socket.write(zpl, 'utf8', (err) => {
      if (err) {
        socket.destroy();
        return res.status(502).json({ message: 'Error enviando datos a la impresora.' });
      }
      socket.end();
      res.json({ message: 'Etiqueta enviada a la impresora.' });
    });
  });

  socket.on('error', () => {
    res.status(502).json({
      message: `No se pudo conectar con la impresora en ${printerIP}:9100. Verifique la IP y que la impresora este encendida.`
    });
  });

  socket.on('timeout', () => {
    socket.destroy();
    res.status(502).json({ message: `Tiempo de espera agotado al conectar con ${printerIP}:9100.` });
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Print relay running on http://localhost:${PORT}`);
  console.log(`The frontend will try this address after the cloud backend fails.`);
});
