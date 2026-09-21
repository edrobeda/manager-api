// sessao_id agrupa eventos da MESMA visita (gerado no navegador, guardado em
// sessionStorage) — sem isso, nao da pra reconstruir o percurso de UMA
// pessoa na pagina eventifylab.com/links (visualizacao + cliques) quando
// varios visitantes estao navegando ao mesmo tempo. Ver routes/linksTrack.js.
exports.up = function (knex) {
  return knex.schema.alterTable('acessos', (t) => {
    t.string('sessao_id', 64).nullable();
    t.index('sessao_id');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('acessos', (t) => {
    t.dropColumn('sessao_id');
  });
};
