const knex = require('knex');
const knexConfig = require('./knexfile.vitrine');
module.exports = knex(knexConfig.development);
