const router = require('express').Router();
const crypto = require('crypto');
const dbCore = require('../db.core');
const { calcStatus } = require('../utils/calcStatus');

// POST /api/keys/validate { token }
// Valida chave de device → contexto de ativação. Mesmo padrão hash+lookup de
// middleware/basicAuth.js, só que contra o api_keys do core em vez de basic_auth_keys.
router.post('/validate', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ error: 'Chave inválida ou inativa' });

    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const key = await dbCore('api_keys').where({ token_hash: hash, ativo: true }).first();
    if (!key) return res.status(401).json({ error: 'Chave inválida ou inativa' });

    if (!key.ativacao_id) {
      // Chave válida sem ativação vinculada → considerada ativa enquanto existir
      // (mesmo comportamento do basic_auth_keys sem evento_id hoje, ver routes/game.js).
      return res.json({ ativacao_id: null, evento_id: null, produto: null, tenant_id: null, janela_ativa: true });
    }

    const ativacao = await dbCore('ativacoes').where({ id: key.ativacao_id }).first();
    if (!ativacao) return res.json({ ativacao_id: key.ativacao_id, evento_id: null, produto: null, tenant_id: null, janela_ativa: false });

    const evento = await dbCore('eventos').where({ id: ativacao.evento_id }).first();
    const produto = await dbCore('produtos').where({ id: ativacao.produto_id }).first();

    const status = calcStatus({
      data_inicio: ativacao.data_inicio ?? evento?.data_inicio,
      data_fim: ativacao.data_fim ?? evento?.data_fim,
    });

    res.json({
      ativacao_id: ativacao.id,
      evento_id: ativacao.evento_id,
      produto: produto?.slug ?? null,
      tenant_id: evento?.tenant_id ?? null,
      janela_ativa: status === 'ativo',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
