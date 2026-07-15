// Garante que o mesmo destino (ex: ficha de um produto) dentro do mesmo evento
// sempre reutiliza o mesmo link curto, em vez de gerar um novo a cada chamada —
// senão o QR code do totem mudaria de código toda hora e o analytics fragmentaria.
exports.up = function(knex) {
  return knex.schema.alterTable('short_links', (t) => {
    t.unique(['url_destino', 'evento_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('short_links', (t) => {
    t.dropUnique(['url_destino', 'evento_id']);
  });
};
