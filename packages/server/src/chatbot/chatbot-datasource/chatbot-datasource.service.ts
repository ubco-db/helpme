import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { DataSource } from 'typeorm';

export const chatbotTables = [
  'course_setting',
  'document',
  'document_aggregate',
  'question',
];

@Injectable()
export class ChatbotDataSourceService implements OnModuleDestroy {
  private readonly dataSource: DataSource;

  constructor(private options: PostgresConnectionOptions) {
    this.dataSource = new DataSource(options);
    this.dataSource
      .initialize()
      .catch((err) =>
        console.error(`Failed to initialize Chatbot DataSource: ${err}`),
      );
  }

  async getDataSource() {
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }
    return this.dataSource;
  }

  async initializeTestSchema() {
    if (this.options.database !== 'chatbot_test') {
      throw new Error(
        'Cannot perform schema modification via HelpMe when not testing!',
      );
    }
    await this.dropSchema();
    for (const table of chatbotTables) {
      await this.createTable(table);
    }
  }

  private async dropSchema() {
    const ds = await this.getDataSource();
    const q = ds.createQueryRunner();
    await q.connect();
    await q.startTransaction();
    try {
      for (const table of chatbotTables) {
        await q.query(`
            DROP TABLE IF EXISTS ${table};
        `);
      }
      await q.commitTransaction();
    } catch (e) {
      console.error(e);
      await q.rollbackTransaction();
    } finally {
      await q.release();
    }
  }

  private async createTable(tableName: string) {
    const ds = await this.getDataSource();
    const q = ds.createQueryRunner();
    await q.connect();
    await q.startTransaction();
    try {
      await q.query(`
          CREATE TABLE IF NOT EXISTS public."${tableName}"
          (
              id            UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY, 
              "pageContent" TEXT,
              metadata      JSONB,
              embedding     VECTOR
          );
      `);
      await q.commitTransaction();
    } catch (e) {
      console.error(e);
      await q.rollbackTransaction();
    } finally {
      await q.release();
    }
  }

  async clearTable(tableName: string) {
    if (this.options.database !== 'chatbot_test') {
      throw new Error(
        'Cannot perform schema modification via HelpMe when not testing!',
      );
    }
    const ds = await this.getDataSource();
    const q = ds.createQueryRunner();
    await q.connect();
    await q.startTransaction();
    try {
      await q.query(`
          DELETE FROM ${tableName};
      `);
      await q.commitTransaction();
    } catch (e) {
      console.error(e);
      await q.rollbackTransaction();
    } finally {
      await q.release();
    }
  }

  async onModuleDestroy() {
    if (this.options.database === 'chatbot_test') {
      try {
        await this.dropSchema();
      } catch (err) {
        console.error(err);
      }
    }
    await this.dataSource.destroy();
  }
}
