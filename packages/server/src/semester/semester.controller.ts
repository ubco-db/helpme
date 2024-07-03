import { SemesterPartial } from '@koh/common';
import { Controller, Get } from '@nestjs/common';
import { SemesterModel } from './semester.entity';
import { ApplicationConfigService } from '../config/application_config.service';

@Controller('semesters')
export class SemesterController {
  constructor(private readonly appConfig: ApplicationConfigService) {}

  @Get()
  async get(): Promise<SemesterPartial[]> {
    return SemesterModel.find({
      take: this.appConfig.get('max_semesters'),
    });
  }
}
