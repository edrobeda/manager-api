require('dotenv').config();

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.PG_HOST || 'postgres',
      port: process.env.PG_PORT || 5432,
      user: process.env.PG_USER || 'admin',
      password: process.env.PG_PASSWORD || 'postgres2024!',
      database: process.env.VITRINE_PG_DATABASE || 'vitrine'
    },
    migrations: {
      directory: './migrations-vitrine',
      tableName: 'knex_migrations'
    }
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.PG_HOST || 'postgres',
      port: process.env.PG_PORT || 5432,
      user: process.env.PG_USER || 'admin',
      password: process.env.PG_PASSWORD || 'postgres2024!',
      database: process.env.VITRINE_PG_DATABASE || 'vitrine'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './migrations-vitrine',
      tableName: 'knex_migrations'
    }
  }
};
