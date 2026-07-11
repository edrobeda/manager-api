exports.up = function(knex) {
  return knex('config_totem').insert({
    tenant_id: 45,
    config_slug: 'lang_ativo',
    valor: 'pt',
    tipo: 'idioma',
    ativo: true,
  });
};

exports.down = function(knex) {
  return knex('config_totem').where({ tenant_id: 45, config_slug: 'lang_ativo' }).delete();
};
