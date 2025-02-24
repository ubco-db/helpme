import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationModel } from './organization.entity';
import { SemesterModel } from '../semester/semester.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationModel, SemesterModel])],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
