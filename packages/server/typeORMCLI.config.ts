import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as typeormConfig from './ormconfig';

// Load environment variables
dotenv.config();
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.development' });
}

/**
 * This is the config for the typeorm CLI.
 * It is used to connect to the database and run migrations.
 */

export default new DataSource(typeormConfig as DataSourceOptions);
