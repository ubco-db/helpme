import { Test, TestingModule } from '@nestjs/testing';
import { TestTypeOrmModule } from './util/testUtils';
import { CanvasBatchStore } from '../src/lti/embeddable/canvas-batch/canvas-batch.store';

describe('Canvas batch persistence', () => {
  let module: TestingModule;
  let store: CanvasBatchStore;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [TestTypeOrmModule],
      providers: [CanvasBatchStore],
    }).compile();
    store = module.get(CanvasBatchStore);
  });
  afterAll(async () => module?.close());

  it('excludes duplicate workers and releases the lock after failure', async () => {
    let executions = 0;
    await expect(
      store.withRunLock(7, async () => {
        executions++;
        await store.withRunLock(7, async () => {
          executions++;
        });
        throw new Error('Worker failed');
      }),
    ).rejects.toThrow('Worker failed');
    expect(executions).toBe(1);
    await store.withRunLock(7, async () => {
      executions++;
    });
    expect(executions).toBe(2);
  });
});
