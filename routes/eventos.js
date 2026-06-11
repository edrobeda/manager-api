const router = require('express').Router();
const db = require('../db');

const tenantFilter = (req) =>
  req.user.role === 'superadmin' ? {} : { 'eventos.tenant_id': req.user.tenantId };

// Listar eventos (com status calculado automaticamente)
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const rows = await db('eventos')
      .where(tenantFilter(req))
      .orderBy('data_inicio', 'desc')
      .select('*');

    // recalcula status na leitura
    const eventos = rows.map((e) => ({
      ...e,
      status: calcStatus(e, now),
    }));

    res.json({ success: true, eventos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar evento
router.post('/', async (req, res) => {
  try {
    const { nome, descricao, data_inicio, data_fim } = req.body;
    if (!nome || !data_inicio || !data_fim)
      return res.status(400).json({ error: 'Nome, data_inicio e data_fim são obrigatórios' });

    const tenant_id = req.user.role === 'superadmin'
      ? req.body.tenant_id
      : req.user.tenantId;

    if (!tenant_id) return res.status(400).json({ error: 'tenant_id obrigatório' });

    const [evento] = await db('eventos')
      .insert({ nome, descricao, data_inicio, data_fim, tenant_id, created_by: req.user.userId })
      .returning('*');

    res.status(201).json({ success: true, evento: { ...evento, status: calcStatus(evento) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar evento
router.put('/:id', async (req, res) => {
  try {
    const where = { id: req.params.id, ...tenantFilter(req) };
    const { nome, descricao, data_inicio, data_fim } = req.body;
    const [evento] = await db('eventos').where(where)
      .update({ nome, descricao, data_inicio, data_fim })
      .returning('*');

    if (!evento) return res.status(404).json({ error: 'Evento não encontrado' });
    res.json({ success: true, evento: { ...evento, status: calcStatus(evento) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deletar evento
router.delete('/:id', async (req, res) => {
  try {
    const where = { id: req.params.id, ...tenantFilter(req) };
    const deleted = await db('eventos').where(where).delete();
    if (!deleted) return res.status(404).json({ error: 'Evento não encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eventos expirados ou expirando hoje (para notificações do tenant)
router.get('/alertas', async (req, res) => {
  try {
    const now = new Date();
    const amanha = new Date(now); amanha.setDate(amanha.getDate() + 1);

    const rows = await db('eventos')
      .where(tenantFilter(req))
      .where('data_fim', '<=', amanha)
      .where('data_fim', '>=', new Date('2000-01-01'))
      .orderBy('data_fim', 'asc')
      .select('*');

    const alertas = rows
      .map((e) => ({ ...e, status: calcStatus(e, now) }))
      .filter((e) => e.status === 'encerrado' || e.status === 'expirando');

    res.json({ success: true, alertas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function calcStatus(evento, now = new Date()) {
  const inicio = new Date(evento.data_inicio);
  const fim = new Date(evento.data_fim);
  const amanha = new Date(now); amanha.setDate(amanha.getDate() + 1);

  if (now < inicio) return 'agendado';
  if (now > fim) return 'encerrado';
  if (fim <= amanha) return 'expirando'; // encerra em menos de 24h
  return 'ativo';
}

module.exports = router;
