const router = require('express').Router();
const db = require('../db');

const tenantFilter = (req) =>
  req.user.role === 'superadmin' ? {} : { tenant_id: req.user.tenantId };

const resolverTenant = (req) =>
  (req.user.role === 'superadmin' ? req.body.tenant_id : req.user.tenantId);

// Lista as séries na ordem em que devem aparecer no totem
router.get('/', async (req, res) => {
  try {
    const series = await db('series_totem')
      .where(tenantFilter(req))
      .orderBy([{ column: 'tenant_id' }, { column: 'ordem' }, { column: 'id' }])
      .select('*');
    res.json({ success: true, series });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cria série no fim da lista — a ordem é ajustada depois, por PUT /ordem
router.post('/', async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    const tenant_id = resolverTenant(req);
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id obrigatório' });

    const ultima = await db('series_totem').where({ tenant_id }).max('ordem as max').first();

    const [serie] = await db('series_totem')
      .insert({ tenant_id, nome, ordem: (ultima?.max ?? -1) + 1 })
      .returning('*');

    res.status(201).json({ success: true, serie });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe uma série com esse nome' });
    res.status(500).json({ error: err.message });
  }
});

// Grava a ordem inteira de uma vez: a tela manda a lista de ids já reordenada.
// Em transação porque uma reordenação pela metade deixaria o totem com seções embaralhadas.
router.put('/ordem', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Informe ids com a nova ordem' });

    const series = await db('series_totem').where(tenantFilter(req)).whereIn('id', ids).select('id');
    if (series.length !== ids.length) return res.status(404).json({ error: 'Alguma série não foi encontrada' });

    await db.transaction(async (trx) => {
      for (const [ordem, id] of ids.entries()) {
        await trx('series_totem').where({ id }).update({ ordem, updated_at: trx.fn.now() });
      }
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Renomear mantém o vínculo dos produtos (serie_id), mas precisa refletir na coluna
// legada produtos_totem.serie, que é o que o totem em produção lê hoje.
router.put('/:id', async (req, res) => {
  try {
    const where = { id: req.params.id, ...tenantFilter(req) };
    const { nome, ativo } = req.body;

    const [serie] = await db('series_totem').where(where)
      .update({ nome, ativo, updated_at: db.fn.now() })
      .returning('*');

    if (!serie) return res.status(404).json({ error: 'Série não encontrada' });

    if (nome !== undefined) {
      await db('produtos_totem').where({ serie_id: serie.id }).update({ serie: serie.nome });
    }

    res.json({ success: true, serie });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe uma série com esse nome' });
    res.status(500).json({ error: err.message });
  }
});

// Remove a série (soft delete, como o resto do projeto) e solta os produtos que estavam nela —
// eles voltam a ficar sem série, em vez de apontar para uma seção que não aparece mais.
router.delete('/:id', async (req, res) => {
  try {
    const where = { id: req.params.id, ...tenantFilter(req) };
    const [serie] = await db('series_totem').where(where)
      .update({ ativo: false, updated_at: db.fn.now() })
      .returning('*');

    if (!serie) return res.status(404).json({ error: 'Série não encontrada' });

    await db('produtos_totem').where({ serie_id: serie.id }).update({ serie_id: null, serie: null });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
