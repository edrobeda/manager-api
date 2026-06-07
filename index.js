const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const knex = require('knex');
const knexConfig = require('./knexfile');

const app = express();
app.use(cors());
app.use(express.json());

// Inicializar Knex
const db = knex(knexConfig.development);

const BACKUP_DIR = '/backups';
const PG_HOST = process.env.PG_HOST || 'postgres';
const PG_USER = process.env.PG_USER || 'admin';
const PG_PASSWORD = process.env.PG_PASSWORD || 'postgres2024!';

// Garantir que o diretório de backups existe
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Listar backups
app.get('/api/backups', (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sql') || f.endsWith('.dump'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        // Extrair tipo do backup pelo nome
        let type = 'completo';
        if (f.includes('_n8n_')) type = 'n8n';
        else if (f.includes('_mydb_')) type = 'mydb';
        else if (f.includes('_eventify_')) type = 'eventify';
        else if (f.includes('_all_')) type = 'completo';

        return {
          name: f,
          size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
          date: stats.mtime.toISOString(),
          type: type,
          path: path.join(BACKUP_DIR, f)
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, backups: files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Listar databases disponíveis
app.get('/api/databases', (req, res) => {
  const databases = [
    { name: 'all', label: 'Todos os bancos', description: 'Backup completo de todos os databases' },
    { name: 'n8n', label: 'N8N', description: 'Workflows, credenciais e configurações do N8N' },
    { name: 'mydb', label: 'MyDB', description: 'Banco principal da aplicação' },
    { name: 'eventify', label: 'Eventify', description: 'Dados do Eventify' }
  ];
  res.json({ success: true, databases });
});

// Criar backup
app.post('/api/backups', (req, res) => {
  const { database = 'all' } = req.body;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${database}_${timestamp}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  let cmd;
  if (database === 'all') {
    // Backup de todos os bancos
    cmd = `PGPASSWORD="${PG_PASSWORD}" pg_dumpall -h ${PG_HOST} -U ${PG_USER} > ${filepath}`;
  } else {
    // Backup de um banco específico
    cmd = `PGPASSWORD="${PG_PASSWORD}" pg_dump -h ${PG_HOST} -U ${PG_USER} -d ${database} > ${filepath}`;
  }

  exec(cmd, { maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
    if (error) {
      console.error('Backup error:', error);
      // Remover arquivo se falhou
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      return res.status(500).json({ success: false, error: error.message });
    }

    const stats = fs.statSync(filepath);
    res.json({
      success: true,
      message: `Backup do ${database === 'all' ? 'todos os bancos' : database} criado com sucesso`,
      backup: {
        name: filename,
        size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
        date: stats.mtime.toISOString(),
        type: database
      }
    });
  });
});

// Restaurar backup
app.post('/api/backups/restore', (req, res) => {
  const { filename } = req.body;

  if (!filename) {
    return res.status(400).json({ success: false, error: 'Filename é obrigatório' });
  }

  const filepath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ success: false, error: 'Arquivo não encontrado' });
  }

  // Determinar tipo de restore baseado no nome do arquivo
  let cmd;
  if (filename.includes('_all_')) {
    // Restore completo
    cmd = `PGPASSWORD="${PG_PASSWORD}" psql -h ${PG_HOST} -U ${PG_USER} -d postgres < ${filepath}`;
  } else {
    // Extrair nome do banco do arquivo
    const match = filename.match(/backup_([^_]+)_/);
    const database = match ? match[1] : 'mydb';
    cmd = `PGPASSWORD="${PG_PASSWORD}" psql -h ${PG_HOST} -U ${PG_USER} -d ${database} < ${filepath}`;
  }

  exec(cmd, { maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
    if (error) {
      console.error('Restore error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: 'Backup restaurado com sucesso'
    });
  });
});

// Deletar backup
app.delete('/api/backups/:filename', (req, res) => {
  const { filename } = req.params;
  const filepath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ success: false, error: 'Arquivo não encontrado' });
  }

  try {
    fs.unlinkSync(filepath);
    res.json({ success: true, message: 'Backup deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download backup
app.get('/api/backups/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filepath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ success: false, error: 'Arquivo não encontrado' });
  }

  res.download(filepath);
});

// ==========================================================
// WEBS ENDPOINTS
// ==========================================================

// Listar todas as webs
app.get('/api/webs', async (req, res) => {
  try {
    const webs = await db('tb_webs')
      .select('*')
      .orderBy('name', 'asc');
    res.json({ success: true, webs });
  } catch (error) {
    console.error('Error fetching webs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Buscar web por ID
app.get('/api/webs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const web = await db('tb_webs')
      .where({ id })
      .first();

    if (!web) {
      return res.status(404).json({ success: false, error: 'Web não encontrada' });
    }

    res.json({ success: true, web });
  } catch (error) {
    console.error('Error fetching web:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Criar nova web
app.post('/api/webs', async (req, res) => {
  try {
    const { name, url, description, favorite } = req.body;

    if (!name || !url) {
      return res.status(400).json({
        success: false,
        error: 'Nome e URL são obrigatórios'
      });
    }

    const [result] = await db('tb_webs').insert({
      name,
      url,
      description: description || null,
      favorite: favorite || false
    }).returning('*');

    res.status(201).json({
      success: true,
      message: 'Web criada com sucesso',
      web: result
    });
  } catch (error) {
    console.error('Error creating web:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar web
app.put('/api/webs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, description, favorite } = req.body;

    const web = await db('tb_webs').where({ id }).first();

    if (!web) {
      return res.status(404).json({ success: false, error: 'Web não encontrada' });
    }

    await db('tb_webs')
      .where({ id })
      .update({
        name: name !== undefined ? name : web.name,
        url: url !== undefined ? url : web.url,
        description: description !== undefined ? description : web.description,
        favorite: favorite !== undefined ? favorite : web.favorite,
        updated_at: db.fn.now()
      });

    const updatedWeb = await db('tb_webs').where({ id }).first();

    res.json({
      success: true,
      message: 'Web atualizada com sucesso',
      web: updatedWeb
    });
  } catch (error) {
    console.error('Error updating web:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deletar web
app.delete('/api/webs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const web = await db('tb_webs').where({ id }).first();

    if (!web) {
      return res.status(404).json({ success: false, error: 'Web não encontrada' });
    }

    await db('tb_webs').where({ id }).delete();

    res.json({
      success: true,
      message: 'Web deletada com sucesso'
    });
  } catch (error) {
    console.error('Error deleting web:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle favorito
app.patch('/api/webs/:id/favorite', async (req, res) => {
  try {
    const { id } = req.params;

    const web = await db('tb_webs').where({ id }).first();

    if (!web) {
      return res.status(404).json({ success: false, error: 'Web não encontrada' });
    }

    await db('tb_webs')
      .where({ id })
      .update({
        favorite: !web.favorite,
        updated_at: db.fn.now()
      });

    const updatedWeb = await db('tb_webs').where({ id }).first();

    res.json({
      success: true,
      message: 'Favorito atualizado com sucesso',
      web: updatedWeb
    });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Migração em lote do localStorage
app.post('/api/webs/migrate', async (req, res) => {
  try {
    const { webs } = req.body;

    if (!Array.isArray(webs) || webs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array de webs é obrigatório'
      });
    }

    const dataToInsert = webs.map(web => ({
      name: web.name,
      url: web.url,
      description: web.description || null,
      favorite: web.favorite || false
    }));

    await db('tb_webs').insert(dataToInsert);

    const insertedWebs = await db('tb_webs')
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(webs.length);

    res.status(201).json({
      success: true,
      message: `${webs.length} página(s) migrada(s) com sucesso`,
      webs: insertedWebs
    });
  } catch (error) {
    console.error('Error migrating webs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`Manager API rodando na porta ${PORT}`);
});
