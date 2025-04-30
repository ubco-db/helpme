import { Module } from '@nestjs/common';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';
import { FactoryService } from 'factory/factory.service';

@Module({
  controllers: [SeedController],
  providers: [SeedService, FactoryService],
})
export class SeedModule {}
