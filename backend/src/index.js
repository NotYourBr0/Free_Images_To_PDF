require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const PDFDocument = require('pdfkit');

const app = express();
app.use(cors());

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const GENERATED_DIR = path.join(__dirname, '..', 'generated');

// Ensure directories exist
for (const p of [UPLOAD_DIR, GENERATED_DIR]) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const allowedMime = new Set(['image/jpeg', 'image/png']);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (_, file, cb) => {
    if (allowedMime.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only .jpg, .jpeg, .png files are allowed'));
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 50
  }
});

app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

app.post('/api/convert', upload.array('images', 50), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No images uploaded' });
  }

  const outName = `output_${Date.now()}.pdf`;
  const outPath = path.join(GENERATED_DIR, outName);

  try {
    // Create PDF
    const doc = new PDFDocument({ autoFirstPage: false, pdfVersion: '1.7' });
    const writeStream = fs.createWriteStream(outPath);
    doc.pipe(writeStream);

    for (const file of req.files) {
      // Add a new page and fit image to full page (A4 by default here)
      const pageSize = 'A4';
      doc.addPage({ size: pageSize, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      doc.image(file.path, {
        fit: [doc.page.width, doc.page.height],
        align: 'center',
        valign: 'center',
        x: 0,
        y: 0,
      });
    }

    doc.end();

    writeStream.on('finish', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="converted.pdf"');
      res.download(outPath, 'converted.pdf', (err) => {
        // Cleanup generated PDF regardless of download success
        fs.unlink(outPath, () => {});
        // Cleanup uploads
        for (const f of req.files) {
          fs.unlink(f.path, () => {});
        }
        if (err) {
          console.error('Download error:', err);
        }
      });
    });

    writeStream.on('error', (err) => {
      console.error('Write stream error:', err);
      try { fs.unlinkSync(outPath); } catch {}
      return res.status(500).json({ error: 'Failed to generate PDF' });
    });
  } catch (e) {
    console.error(e);
    // Attempt cleanup on error
    try { fs.unlinkSync(outPath); } catch {}
    for (const f of req.files) {
      fs.unlink(f.path, () => {});
    }
    return res.status(500).json({ error: 'Server error during conversion' });
  }
});

// Centralized error handling for uploads and Multer
app.use((err, req, res, next) => {
  if (!err) return next();
  // Multer-specific errors
  if (err instanceof multer.MulterError) {
    let msg = 'Upload error';
    if (err.code === 'LIMIT_FILE_SIZE') msg = 'File too large. Max 10MB per file';
    else if (err.code === 'LIMIT_FILE_COUNT') msg = 'Too many files. Max 50';
    else if (err.code === 'LIMIT_UNEXPECTED_FILE') msg = 'Unexpected file field';
    return res.status(400).json({ error: msg });
  }
  // Custom fileFilter error (unsupported MIME types)
  if (err.message && /Only \.jpg, \.jpeg, \.png files are allowed/i.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
