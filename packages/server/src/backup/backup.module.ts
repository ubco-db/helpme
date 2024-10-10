import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';

@Module({
  providers: [BackupService],
})
export class BackupModule {}
