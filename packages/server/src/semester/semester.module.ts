import { Module } from '@nestjs/common';
import { SemesterController } from './semester.controller';
import { SemesterService } from './semester.service';
import { ApplicationConfigModule } from '../config/application_config.module';

@Module({
  controllers: [SemesterController],
  providers: [SemesterService],
  imports: [ApplicationConfigModule],
})
export class SemesterModule {}
