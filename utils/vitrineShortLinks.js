const dbVitrine = require('../db.vitrine');
const { gerarCodigo } = require('./codigoCurto');

// Mesma lógica de utils/shortLinks.js (reaproveita o link curto existente pro mesmo
// destino+ativação, pro QR code não ficar mudando de código), mas contra o banco
// vitrine e escopado por ativacao_id em vez de evento_id.
async function obterOuCriarShortLinkVitrine(urlDestino, ativacaoId, tenantId) {
  let link = await dbVitrine('short_links').where({ url_destino: urlDestino, ativacao_id: ativacaoId }).first();
  if (link) return link;

  try {
    const [novo] = await dbVitrine('short_links')
      .insert({ codigo: gerarCodigo(), url_destino: urlDestino, ativacao_id: ativacaoId, tenant_id: tenantId })
      .returning('*');
    return novo;
  } catch (err) {
    link = await dbVitrine('short_links').where({ url_destino: urlDestino, ativacao_id: ativacaoId }).first();
    if (link) return link;
    throw err;
  }
}

module.exports = { obterOuCriarShortLinkVitrine };
