import { Module } from '@nestjs/common';
import { SemesterController } from './semester.controller';

@Module({
  controllers: [SemesterController],
  providers: [],
  imports: [],
})
export class SemesterModule {}
