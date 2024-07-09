import { Module } from '@nestjs/common';
import { StudentTaskProgressController } from './studentTaskProgress.controller';

@Module({
  controllers: [StudentTaskProgressController],
})
export class StudentTaskProgressModule {}
