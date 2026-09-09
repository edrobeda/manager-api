const crypto = require('crypto');
const dbCore = require('../db.core');

// Resolve um token de dispositivo (mesmo formato Basic usado pelo totem/kiosk hoje)
// pro contexto de ativação, via api_keys/ativacoes do core (eventifylab). Usado pelos
// apps novos multitenant (Vitrine, e futuramente Jogo) em vez do lookup local em
// basic_auth_keys que as rotas legadas (mydb) ainda usam.
async function resolveAtivacaoPorToken(token) {
  if (!token) return null;
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const key = await dbCore('api_keys').where({ token_hash: hash, ativo: true }).first();
  if (!key || !key.ativacao_id) return null;

  const ativacao = await dbCore('ativacoes').where({ id: key.ativacao_id }).first();
  if (!ativacao) return null;

  const evento = await dbCore('eventos').where({ id: ativacao.evento_id }).first();
  const produto = await dbCore('produtos').where({ id: ativacao.produto_id }).first();

  return {
    ativacao_id: ativacao.id,
    evento_id: ativacao.evento_id,
    tenant_id: evento?.tenant_id ?? null,
    produto: produto?.slug ?? null,
  };
}

module.exports = { resolveAtivacaoPorToken };
