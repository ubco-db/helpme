import { ERROR_MESSAGES } from '@koh/common';
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseModel } from '../course/course.entity';
import { OrganizationChatbotSettingsModel } from '../chatbot/chatbot-infrastructure-models/organization-chatbot-settings.entity';

/**
 * This is a guard which prevents access to legacy Chatbot endpoints in
 * courses that are using the modern changes to the structure.
 *
 * This is to prevent rampant desynchronization as old endpoints are stumbled upon.
 */
@Injectable()
export class ChatbotLegacyEndpointGuard implements CanActivate {
  async setupData(request: any): Promise<{ courseId: number }> {
    const courseId =
      request.params.id ??
      request.params.courseId ??
      request.params.cid ??
      null;
    return { courseId };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { courseId } = await this.setupData(request);

    if (!courseId) {
      throw new NotFoundException(ERROR_MESSAGES.roleGuard.noCourseIdFound);
    }

    return await this.checkIsLegacy(courseId, request.url);
  }

  async checkIsLegacy(courseId: number, endpoint: string): Promise<boolean> {
    const course = await CourseModel.findOne({
      where: { id: courseId },
      relations: { organizationCourse: true },
    });

    const organizationSettings = await OrganizationChatbotSettingsModel.findOne(
      {
        where: {
          organizationId: course.organizationCourse.organizationId,
        },
      },
    );

    if (organizationSettings) {
      throw new BadRequestException(
        ERROR_MESSAGES.chatbotEndpointGuard.legacyEndpointIncompatible(
          endpoint,
        ),
      );
    }

    return true;
  }
}
