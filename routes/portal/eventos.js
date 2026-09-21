const router = require('express').Router();
const db = require('../../db.core');

function requireTenant(req, res) {
  if (!req.user.tenantId) {
    res.status(400).json({ error: 'Portal do cliente: é preciso logar pelo domínio do tenant (ex.: {tenant}.eventifylab.com)' });
    return null;
  }
  return req.user.tenantId;
}

// CRUD completo, mas sempre escopado ao tenant do JWT — nunca aceita tenant_id do
// body (diferente da rota staff /api/eventos, que aceita override por superadmin).
// origem é sempre 'cliente' aqui (não vem do body), pra diferenciar de eventos
// criados pelo staff (origem 'interno', tabela mydb — gap conhecido, ver ROADMAP).

// GET /api/portal/eventos — lista os eventos do tenant
router.get('/', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;

  try {
    const eventos = await db('eventos')
      .where({ tenant_id: tenantId })
      .orderBy('data_inicio', 'desc')
      .select('*');

    res.json({ success: true, eventos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/eventos — cria evento do próprio tenant
router.post('/', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;

  try {
    const { nome, descricao, data_inicio, data_fim, local } = req.body;
    if (!nome || !data_inicio || !data_fim) {
      return res.status(400).json({ error: 'Nome, data_inicio e data_fim são obrigatórios' });
    }

    // eventos.created_by referencia core.users, mas core.users só foi semeado
    // uma vez na Fase 0 (scripts/seed-core-from-mydb.js) — qualquer usuário criado
    // no mydb depois disso não existe no core ainda (gap conhecido, ver ROADMAP).
    // Sem essa checagem, o INSERT quebra com violação de FK pra qualquer usuário
    // novo tentando criar evento pelo portal.
    const usuarioExisteNoCore = await db('users').where({ id: req.user.userId }).first();

    const [evento] = await db('eventos')
      .insert({
        tenant_id: tenantId,
        nome,
        descricao,
        data_inicio,
        data_fim,
        local: local ? JSON.stringify(local) : null,
        origem: 'cliente',
        created_by: usuarioExisteNoCore ? req.user.userId : null,
      })
      .returning('*');

    res.status(201).json({ success: true, evento });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/portal/eventos/:id — edita evento do próprio tenant
router.put('/:id', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;

  try {
    const { nome, descricao, data_inicio, data_fim, local } = req.body;

    const [evento] = await db('eventos')
      .where({ id: req.params.id, tenant_id: tenantId })
      .update({
        nome,
        descricao,
        data_inicio,
        data_fim,
        local: local ? JSON.stringify(local) : null,
      })
      .returning('*');

    if (!evento) return res.status(404).json({ error: 'Evento não encontrado' });
    res.json({ success: true, evento });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/portal/eventos/:id — remove evento do próprio tenant
router.delete('/:id', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;

  try {
    const deleted = await db('eventos').where({ id: req.params.id, tenant_id: tenantId }).delete();
    if (!deleted) return res.status(404).json({ error: 'Evento não encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
