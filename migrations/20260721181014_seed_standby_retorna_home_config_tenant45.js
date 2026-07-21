exports.up = function(knex) {
  return knex('config_totem').insert({
    tenant_id: 45,
    config_slug: 'standby_retorna_home',
    valor: '0',
    tipo: 'contagem',
    ativo: true,
  });
};

exports.down = function(knex) {
  return knex('config_totem').where({ tenant_id: 45, config_slug: 'standby_retorna_home' }).delete();
};
