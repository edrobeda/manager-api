const router = require('express').Router();
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');

const TIPOS_ACEITOS = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
];
const TAMANHO_MAXIMO = 250 * 1024 * 1024; // 250MB — cobre vídeos de reels em alta qualidade

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const nomeUnico = `${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, nomeUnico);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: TAMANHO_MAXIMO },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_ACEITOS.includes(file.mimetype)) return cb(new Error('Tipo de arquivo não aceito — envie JPEG, PNG, WEBP, GIF, MP4, WEBM ou MOV'));
    cb(null, true);
  },
});

router.post('/', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const url = `${req.protocol}://${req.get('host')}/api/uploads/${req.file.filename}`;
    res.status(201).json({ success: true, url });
  });
});

module.exports = router;
