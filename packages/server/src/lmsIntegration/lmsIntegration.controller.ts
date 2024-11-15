import { Controller, Param, ParseIntPipe } from '@nestjs/common';
import { Get } from '@nestjs/common/decorators';
import { CourseRole } from '../decorators/course-role.decorator';
import { Role } from '@koh/common';
import { LMSIntegrationService } from './lmsIntegration.service';

@Controller('lmsIntegration')
export class LMSIntegrationController {
  constructor(private integrationService: LMSIntegrationService) {}

  @Get(':courseId/students')
  async getStudents(
    @CourseRole() role: Role,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    if (role != Role.PROFESSOR) return;
    return this.integrationService.getStudents(courseId);
  }

  @Get('/:courseId/assignments')
  async getAssignments(
    @CourseRole() role: Role,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    if (role != Role.PROFESSOR) return;
    return this.integrationService.getAssignments(courseId);
  }
}
