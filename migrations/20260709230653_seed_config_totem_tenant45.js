exports.up = function(knex) {
  return knex('config_totem').insert({
    tenant_id: 45,
    config_slug: 'banner_delay',
    valor: '2',
    tipo: 's',
    ativo: true,
  });
};

exports.down = function(knex) {
  return knex('config_totem').where({ tenant_id: 45, config_slug: 'banner_delay' }).delete();
};
