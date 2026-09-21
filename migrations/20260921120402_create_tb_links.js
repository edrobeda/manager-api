/**
 * Linktree publico (eventifylab.com/links) — lista de botoes configuravel
 * pelo Manager (aba "Links"). "position" define a ordem de exibicao;
 * "active" controla se aparece na pagina publica sem precisar excluir o
 * registro (ver routes/linksPublic.js, filtra active = true).
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('tb_links', (table) => {
    table.increments('id').primary();
    table.string('label', 255).notNullable();
    table.text('url').notNullable();
    table.text('icon_url');
    table.integer('position').notNullable().defaultTo(0);
    table.boolean('active').notNullable().defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('tb_links');
};
