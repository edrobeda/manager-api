module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.PG_HOST || 'postgres',
      port: process.env.PG_PORT || 5432,
      user: process.env.PG_USER || 'admin',
      password: process.env.PG_PASSWORD || 'postgres2024!',
      database: process.env.PG_DATABASE || 'mydb'
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './seeds'
    }
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.PG_HOST || 'postgres',
      port: process.env.PG_PORT || 5432,
      user: process.env.PG_USER || 'admin',
      password: process.env.PG_PASSWORD || 'postgres2024!',
      database: process.env.PG_DATABASE || 'mydb'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './seeds'
    }
  }
};
