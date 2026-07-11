const router = require('express').Router();
const authorize = require('../middleware/authorize');
const db = require('../db');

const tenantFilter = (req) =>
  req.user.role === 'superadmin' ? {} : { 'clientes.tenant_id': req.user.tenantId };

// GET /clientes?tenant_id=X
router.get('/', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    const filter = tenantFilter(req);
    if (req.user.role === 'superadmin' && req.query.tenant_id) {
      filter['clientes.tenant_id'] = req.query.tenant_id;
    }

    const rows = await db('clientes')
      .where(filter)
      .leftJoin('tenants', 'clientes.tenant_id', 'tenants.id')
      .select(
        'clientes.*',
        'tenants.nome as tenant_nome',
        'tenants.slug as tenant_slug',
      )
      .orderBy('clientes.criado_em', 'desc');

    res.json({ success: true, clientes: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /clientes/grupos — lista tenants com contagem de leads (superadmin)
router.get('/grupos', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    let tenantsQuery = db('tenants').select('id', 'nome', 'slug', 'cor_primaria');
    if (req.user.role !== 'superadmin') {
      tenantsQuery = tenantsQuery.where({ id: req.user.tenantId });
    }
    const tenants = await tenantsQuery;

    const counts = await db('clientes')
      .select('tenant_id')
      .count('* as total')
      .groupBy('tenant_id');

    const countMap = Object.fromEntries(counts.map(r => [r.tenant_id, Number(r.total)]));

    const eventos = await db('eventos')
      .select('id', 'nome', 'tenant_id', 'data_inicio', 'data_fim', 'status')
      .orderBy('data_inicio', 'desc');

    const eventoMap = {};
    for (const e of eventos) {
      if (!eventoMap[e.tenant_id]) eventoMap[e.tenant_id] = [];
      eventoMap[e.tenant_id].push(e);
    }

    const grupos = tenants.map(t => ({
      ...t,
      total_leads: countMap[t.id] || 0,
      eventos: eventoMap[t.id] || [],
    }));

    res.json({ success: true, grupos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { nome, cpf, email, perfil, telefone } = req.body;
    const tenant_id = req.user.role === 'superadmin' ? req.body.tenant_id : req.user.tenantId;
    const [row] = await db('clientes').insert({ nome, cpf, email, perfil, telefone, tenant_id }).returning('*');
    res.status(201).json({ success: true, cliente: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const filter = req.user.role === 'superadmin' ? {} : { tenant_id: req.user.tenantId };
    const deleted = await db('clientes').where({ id: req.params.id, ...filter }).delete();
    if (!deleted) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
