import { config } from 'dotenv';
import { isProd } from '@koh/common';
import * as fs from 'fs';
import { DataSourceOptions } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

// set .envs to their default values if the developer hasn't yet set them
if (fs.existsSync('.env')) {
  config();
} else {
  console.log(
    'No .env file found, using .env.development as fallback. If you are a new developer, please create your .env files (see NEWDEVS_STARTHERE.md)',
  );
  config({ path: '.env.development' });
}
if (fs.existsSync('postgres.env')) {
  config({ path: 'postgres.env' });
} else {
  console.error(
    'No postgres.env file found. If you are a new developer, please create your postgres.env file from postgres.env.example (see NEWDEVS_STARTHERE.md). Your database will not connect without it.',
  );
}

const typeorm: PostgresConnectionOptions = {
  type: 'postgres',
  url: !isProd()
    ? `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5432/chatbot`
    : `postgres://${process.env.POSTGRES_NONROOT_USER}:${process.env.POSTGRES_NONROOT_PASSWORD}@coursehelp.ubc.ca:5432/chatbot`,
  synchronize: false,
  logging:
    process.env.NODE_ENV !== 'production'
      ? ['error', 'warn']
      : !!process.env.TYPEORM_LOGGING,
};
module.exports = typeorm;
