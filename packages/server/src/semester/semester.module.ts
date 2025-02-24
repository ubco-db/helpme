import { Module } from '@nestjs/common';
import { SemesterController } from './semester.controller';
import { SemesterService } from './semester.service';
import { ApplicationConfigModule } from '../config/application_config.module';

// TODO: remove this service (semesters will be fetched with organization or course data so it's be in those controllers instead)

@Module({
  controllers: [SemesterController],
  providers: [SemesterService],
  imports: [],
})
export class SemesterModule {}
