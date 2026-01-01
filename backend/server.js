const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');


const app = express();
app.use(cors());

// Configuración de destino
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'docs'));
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // 👈 MISMO NOMBRE
  }
});

const upload = multer({ storage });

// Endpoint de subida múltiple
app.post('/upload', (req, res) => {
  upload.array('files')(req, res, (err) => {
    if (err) {
      console.error('❌ Error Multer:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    try {
      const metadataRaw = req.body.metadata;
      let metadata = {};

      // Metadata enviada desde frontend (si existe)
      if (metadataRaw) {
        metadata = JSON.parse(metadataRaw);
      }

      // Trucar / completar info mínima
      const finalMeta = {
        access_level: metadata.access_level || "publico",
        owner_department: metadata.owner_department || "[1014] Sistemas",
        content_hash: metadata.content_hash || "hash_no_disponible"
      };

      // Crear .meta por cada archivo
      req.files.forEach(file => {
        const metaPath = path.join(
          file.destination,
          `${file.originalname}.meta`
        );

        fs.writeFileSync(
          metaPath,
          JSON.stringify(finalMeta, null, 2),
          'utf-8'
        );
      });

      console.log(`📁 Archivos guardados: ${req.files.length}`);
      res.json({
        status: 'success' // o duplicate / error
      });

    } catch (e) {
      console.error('❌ Error creando .meta:', e);
      res.status(500).json({ success: false });
    }
  });
});


app.listen(3000, () => {
  console.log('🚀 Servidor escuchando en http://localhost:3000');
});

