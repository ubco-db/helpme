import * as fs from 'fs';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import {
  getTestRedisChannelPrefix,
  getTestUploadLocation,
  getWorkerId,
} from './testEnvironment';

// Match GitHub Actions (UTC) so date snapshots and expiry boundaries are stable locally.
process.env.TZ = 'UTC';

// Load the same environment files as `ormconfig.ts` before any test module is
// imported. Test helpers read POSTGRES_* at module load time.
const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const envPath = path.join(SERVER_ROOT, '.env');
const envDevelopmentPath = path.join(SERVER_ROOT, '.env.development');
loadEnv({
  path: fs.existsSync(envPath) ? envPath : envDevelopmentPath,
});
loadEnv({ path: path.join(SERVER_ROOT, 'postgres.env') });

// Isolate resources that are shared at the process/machine level.
const workerId = getWorkerId();
process.env.UPLOAD_LOCATION = getTestUploadLocation(workerId);
process.env.REDIS_CHANNEL_PREFIX = getTestRedisChannelPrefix(workerId);
fs.mkdirSync(process.env.UPLOAD_LOCATION, { recursive: true });
