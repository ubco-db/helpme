import { DataSource, DataSourceOptions } from 'typeorm';
import * as typeormConfig from './ormconfig';

/**
 * This is the config for the typeorm CLI.
 * It is used to connect to the database and run migrations.
 */

export default new DataSource(typeormConfig as DataSourceOptions);
