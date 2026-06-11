const router = require('express').Router();
const crypto = require('crypto');
const db = require('../db');

const onlySuper = (req, res, next) => {
  if (req.user?.role !== 'superadmin') return res.status(403).json({ error: 'Acesso restrito ao superadmin' });
  next();
};

// Lista todas as chaves (token nunca retorna)
router.get('/', onlySuper, async (req, res) => {
  try {
    const keys = await db('basic_auth_keys')
      .select('id', 'nome', 'ativo', 'created_at')
      .orderBy('created_at', 'desc');
    res.json(keys);
  } catch {
    res.status(500).json({ error: 'Erro ao listar chaves' });
  }
});

// Cria nova chave — retorna o token apenas uma vez
router.post('/', onlySuper, async (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

  const token = crypto.randomBytes(32).toString('hex');
  const hash  = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const [row] = await db('basic_auth_keys').insert({
      nome: nome.trim(),
      token_hash: hash,
      ativo: true,
      created_by: req.user?.userId || null,
    }).returning('id');
    const id = row?.id ?? row;
    res.status(201).json({ id, nome: nome.trim(), token, ativo: true });
  } catch {
    res.status(500).json({ error: 'Erro ao criar chave' });
  }
});

// Ativa / desativa
router.patch('/:id', onlySuper, async (req, res) => {
  const { ativo } = req.body;
  if (typeof ativo !== 'boolean') return res.status(400).json({ error: 'Campo ativo (boolean) obrigatório' });

  try {
    const updated = await db('basic_auth_keys').where({ id: req.params.id }).update({ ativo });
    if (!updated) return res.status(404).json({ error: 'Chave não encontrada' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar chave' });
  }
});

// Remove
router.delete('/:id', onlySuper, async (req, res) => {
  try {
    const deleted = await db('basic_auth_keys').where({ id: req.params.id }).delete();
    if (!deleted) return res.status(404).json({ error: 'Chave não encontrada' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir chave' });
  }
});

module.exports = router;
