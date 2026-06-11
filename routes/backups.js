const router = require('express').Router();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const authorize = require('../middleware/authorize');

const BACKUP_DIR = '/backups';
const PG_HOST = process.env.PG_HOST || 'postgres';
const PG_USER = process.env.PG_USER || 'admin';
const PG_PASSWORD = process.env.PG_PASSWORD || 'postgres2024!';

router.get('/', authorize('superadmin', 'admin'), (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sql') || f.endsWith('.dump'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        let type = 'completo';
        if (f.includes('_n8n_')) type = 'n8n';
        else if (f.includes('_mydb_')) type = 'mydb';
        else if (f.includes('_eventify_')) type = 'eventify';
        return { name: f, size: (stats.size / 1024 / 1024).toFixed(2) + ' MB', date: stats.mtime.toISOString(), type };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, backups: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/databases', authorize('superadmin', 'admin'), (req, res) => {
  res.json({ success: true, databases: [
    { name: 'all',      label: 'Todos os bancos', description: 'Backup completo de todos os databases' },
    { name: 'n8n',      label: 'N8N',             description: 'Workflows, credenciais e configurações do N8N' },
    { name: 'mydb',     label: 'MyDB',            description: 'Banco principal da aplicação' },
    { name: 'eventify', label: 'Eventify',        description: 'Dados do Eventify' },
  ]});
});

router.post('/', authorize('superadmin', 'admin'), (req, res) => {
  const { database = 'all' } = req.body;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${database}_${timestamp}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  const cmd = database === 'all'
    ? `PGPASSWORD="${PG_PASSWORD}" pg_dumpall -h ${PG_HOST} -U ${PG_USER} > ${filepath}`
    : `PGPASSWORD="${PG_PASSWORD}" pg_dump -h ${PG_HOST} -U ${PG_USER} -d ${database} > ${filepath}`;

  exec(cmd, { maxBuffer: 1024 * 1024 * 100 }, (error) => {
    if (error) {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      return res.status(500).json({ success: false, error: error.message });
    }
    const stats = fs.statSync(filepath);
    res.json({ success: true, message: `Backup criado com sucesso`, backup: { name: filename, size: (stats.size / 1024 / 1024).toFixed(2) + ' MB', date: stats.mtime.toISOString(), type: database } });
  });
});

router.post('/restore', authorize('superadmin'), (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ success: false, error: 'Filename é obrigatório' });
  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ success: false, error: 'Arquivo não encontrado' });

  const match = filename.match(/backup_([^_]+)_/);
  const database = filename.includes('_all_') ? 'postgres' : (match ? match[1] : 'mydb');
  const cmd = `PGPASSWORD="${PG_PASSWORD}" psql -h ${PG_HOST} -U ${PG_USER} -d ${database} < ${filepath}`;

  exec(cmd, { maxBuffer: 1024 * 1024 * 100 }, (error) => {
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Backup restaurado com sucesso' });
  });
});

router.delete('/:filename', authorize('superadmin'), (req, res) => {
  const filepath = path.join(BACKUP_DIR, req.params.filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ success: false, error: 'Arquivo não encontrado' });
  try {
    fs.unlinkSync(filepath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/download/:filename', authorize('superadmin', 'admin'), (req, res) => {
  const filepath = path.join(BACKUP_DIR, req.params.filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ success: false, error: 'Arquivo não encontrado' });
  res.download(filepath);
});

module.exports = router;
