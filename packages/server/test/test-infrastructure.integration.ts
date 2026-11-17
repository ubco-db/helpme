import { DataSource } from 'typeorm';
import { ApplicationConfigModel } from '../src/config/application_config.entity';
import {
  getTestDatabaseName,
  getTestRedisDb,
  getWorkerId,
} from './setup/testEnvironment';
import { resetDatabase, TestTypeOrmConfig } from './util/testUtils';

/**
 * Guards the parallel-test infrastructure itself. If these break, suites can
 * silently start sharing databases again, which is very hard to debug.
 */
describe('Test infrastructure', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource(TestTypeOrmConfig);
    await dataSource.initialize();
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('gives every Jest worker its own database and Redis database', () => {
    const workerId = getWorkerId();
    expect(TestTypeOrmConfig.database).toBe(
      getTestDatabaseName('test', workerId),
    );
    expect(TestTypeOrmConfig.database).not.toBe('test');
    expect(getTestRedisDb(workerId)).toBeGreaterThanOrEqual(1);
  });

  it('resetDatabase clears rows and restarts identity sequences', async () => {
    const repository = dataSource.getRepository(ApplicationConfigModel);

    await resetDatabase(dataSource);
    const first = await repository.save(repository.create());
    expect(first.id).toBe(1);

    const extra = await repository.save(repository.create());
    expect(extra.id).toBe(2);

    await resetDatabase(dataSource);
    expect(await repository.count()).toBe(0);

    const afterReset = await repository.save(repository.create());
    expect(afterReset.id).toBe(1);
  });
});
