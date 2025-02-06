import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';

@Module({
  imports: [AuthModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, AuthService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
