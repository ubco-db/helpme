import { config } from 'dotenv';
import { isProd } from '@koh/common';
import * as fs from 'fs';
import { DataSourceOptions } from 'typeorm';

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
// Options only used whe run via CLI
const inCLI = {
  migrations: ['migration/*.ts'],
};

const typeorm: DataSourceOptions = {
  type: 'postgres',
  url: !isProd()
    ? `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5432/dev`
    : `postgres://${process.env.POSTGRES_NONROOT_USER}:${process.env.POSTGRES_NONROOT_PASSWORD}@coursehelp.ubc.ca:5432/prod`,
  synchronize: process.env.NODE_ENV !== 'production',
  entities: ['src/**/**.entity.ts'],
  logging:
    process.env.NODE_ENV !== 'production'
      ? ['query', 'error', 'schema', 'warn', 'info', 'log']
      : !!process.env.TYPEORM_LOGGING,
  ...(!!process.env.TYPEORM_CLI ? inCLI : {}),
};
module.exports = typeorm;
