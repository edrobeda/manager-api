const router = require('express').Router();
const db = require('../../db.core');

// Portal do cliente (Fase 4 do ROADMAP.md) — sem bypass de superadmin: só serve o
// próprio tenant do JWT. Superadmin (tenantId vazio) não tem "seu" tenant aqui, tem
// que logar pelo domínio do tenant (ver Login.jsx / getSlugFromHost).
function requireTenant(req, res) {
  if (!req.user.tenantId) {
    res.status(400).json({ error: 'Portal do cliente: é preciso logar pelo domínio do tenant (ex.: {tenant}.eventifylab.com)' });
    return null;
  }
  return req.user.tenantId;
}

// GET /api/portal/faturamento — devolve o cadastro fiscal do tenant, ou objeto vazio
// se ainda não preencheu (1:1, tenant_faturamento.tenant_id é unique).
router.get('/', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;

  try {
    const faturamento = await db('tenant_faturamento').where({ tenant_id: tenantId }).first();
    res.json({ success: true, faturamento: faturamento || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/portal/faturamento — upsert (cria se não existir, atualiza se existir).
router.put('/', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;

  try {
    const {
      razao_social,
      documento,
      ie,
      endereco,
      contato_financeiro_nome,
      contato_financeiro_email,
      contato_financeiro_telefone,
      email_nota_fiscal,
    } = req.body;

    const [faturamento] = await db('tenant_faturamento')
      .insert({
        tenant_id: tenantId,
        razao_social,
        documento,
        ie,
        endereco: endereco ? JSON.stringify(endereco) : null,
        contato_financeiro_nome,
        contato_financeiro_email,
        contato_financeiro_telefone,
        email_nota_fiscal,
      })
      .onConflict('tenant_id')
      .merge()
      .returning('*');

    res.json({ success: true, faturamento });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
