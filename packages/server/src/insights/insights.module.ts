import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { InsightsCommand } from './insights.command';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';

@Module({
  controllers: [InsightsController],
  imports: [CacheModule.register()],
  providers: [InsightsCommand, InsightsService],
})
export class InsightsModule {}
