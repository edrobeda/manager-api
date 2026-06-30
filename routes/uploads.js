const router = require('express').Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const authorize = require('../middleware/authorize');

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
  'image/webp': '.webp', 'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/xml': '.xml', 'application/xml': '.xml',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ALLOWED[file.mimetype] || '';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${base}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    ALLOWED[file.mimetype] ? cb(null, true) : cb(new Error(`Tipo não permitido: ${file.mimetype}`)),
});

// Garante que o nome do arquivo não escapa de UPLOAD_DIR
const safeFilePath = (filename) => {
  const filepath = path.join(UPLOAD_DIR, path.basename(filename));
  return filepath;
};

router.get('/', authorize('superadmin', 'admin', 'viewer'), (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR)
      .map(f => {
        const stats = fs.statSync(path.join(UPLOAD_DIR, f));
        return { name: f, size: (stats.size / 1024).toFixed(1) + ' KB', date: stats.mtime.toISOString() };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', authorize('superadmin', 'admin'), (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    next();
  });
}, (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'Nenhum arquivo recebido' });
  const stats = fs.statSync(req.file.path);
  res.status(201).json({
    success: true,
    file: { name: req.file.filename, size: (stats.size / 1024).toFixed(1) + ' KB', date: stats.mtime.toISOString() },
  });
});

router.get('/download/:filename', authorize('superadmin', 'admin', 'viewer'), (req, res) => {
  const filepath = safeFilePath(req.params.filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ success: false, error: 'Arquivo não encontrado' });
  res.download(filepath);
});

router.delete('/:filename', authorize('superadmin', 'admin'), (req, res) => {
  const filepath = safeFilePath(req.params.filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ success: false, error: 'Arquivo não encontrado' });
  try {
    fs.unlinkSync(filepath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
