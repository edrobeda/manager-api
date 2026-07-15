const db = require('../db');
const { gerarCodigo } = require('./codigoCurto');

// Reaproveita o link curto existente pro mesmo destino+evento (ex: ficha de um
// produto) em vez de criar um novo a cada chamada — o QR code do totem precisa
// ficar estável, senão o analytics de scan fragmenta em vários códigos.
async function obterOuCriarShortLink(urlDestino, eventoId) {
  let link = await db('short_links').where({ url_destino: urlDestino, evento_id: eventoId }).first();
  if (link) return link;

  try {
    const [novo] = await db('short_links')
      .insert({ codigo: gerarCodigo(), url_destino: urlDestino, evento_id: eventoId })
      .returning('*');
    return novo;
  } catch (err) {
    // corrida: outra requisição criou o mesmo destino/evento nesse meio tempo
    link = await db('short_links').where({ url_destino: urlDestino, evento_id: eventoId }).first();
    if (link) return link;
    throw err;
  }
}

module.exports = { obterOuCriarShortLink };
