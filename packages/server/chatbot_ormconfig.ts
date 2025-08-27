import { config } from 'dotenv';
import { isProd } from '@koh/common';
import * as fs from 'fs';
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

const usr = !isProd() ? 'POSTGRES_USER' : 'POSTGRES_NONROOT_USER';
const pwd = !isProd() ? 'POSTGRES_PASSWORD' : 'POSTGRES_NONROOT_PASSWORD';

const typeorm: PostgresConnectionOptions = {
  type: 'postgres',
  url: `postgres://${process.env[usr]}:${process.env[pwd]}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_CHATBOT_DB}`,
  synchronize: false,
  logging:
    process.env.NODE_ENV !== 'production'
      ? ['error', 'warn']
      : !!process.env.TYPEORM_LOGGING,
};
module.exports = typeorm;
