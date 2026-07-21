const fs = require('fs');
const path = require('path');

// Fonte: data/cidades-ibge.json — lista de estados (nome, sigla) com as
// cidades de cada um (ID e NOME). Um item vem vazio no JSON original
// (glitch da fonte) e é ignorado no parse abaixo.
function carregarEstadosCidades() {
  const bruto = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../data/cidades-ibge.json'), 'utf8')
  );

  const estados = [];
  const cidades = [];

  for (const item of bruto) {
    if (!item.cidade) continue;
    estados.push({ sigla: item.sigla, nome: item.nome });
    for (const c of item.cidade.content) {
      cidades.push({ id: parseInt(c.ID, 10), nome: c.NOME, estado_sigla: item.sigla });
    }
  }

  return { estados, cidades };
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('estados', (t) => {
    t.string('sigla', 2).primary();
    t.string('nome', 100).notNullable();
  });

  await knex.schema.createTable('cidades', (t) => {
    t.integer('id').primary();
    t.string('nome', 150).notNullable();
    t.string('estado_sigla', 2).notNullable().references('sigla').inTable('estados');
    t.index('nome');
    t.index('estado_sigla');
  });

  const { estados, cidades } = carregarEstadosCidades();
  await knex.batchInsert('estados', estados, 100);
  await knex.batchInsert('cidades', cidades, 500);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTable('cidades');
  await knex.schema.dropTable('estados');
};
