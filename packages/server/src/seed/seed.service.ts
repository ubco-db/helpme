import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SeedService {
  constructor(private dataSource: DataSource) {}

  async deleteAll(model: any): Promise<void> {
    await this.dataSource.createQueryBuilder().delete().from(model).execute();
  }
}
