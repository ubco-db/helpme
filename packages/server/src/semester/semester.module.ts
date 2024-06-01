import { Module } from '@nestjs/common';
import { SemesterController } from './semester.controller';
import { SemesterService } from './semester.service';

@Module({
  controllers: [SemesterController],
  providers: [SemesterService],
})
export class SemesterModule {}
