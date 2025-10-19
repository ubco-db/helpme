import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklySummaryService } from './weekly-summary.service';
import { WeeklySummaryController } from './weekly-summary.controller';
import { MailModule } from '../mail/mail.module';
import { CourseModel } from '../course/course.entity';
import { UserCourseModel } from '../profile/user-course.entity';
import { InteractionModel } from '../chatbot/interaction.entity';
import { AsyncQuestionModel } from '../asyncQuestion/asyncQuestion.entity';
import { AsyncQuestionCommentModel } from '../asyncQuestion/asyncQuestionComment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourseModel,
      UserCourseModel,
      InteractionModel,
      AsyncQuestionModel,
      AsyncQuestionCommentModel,
    ]),
    MailModule,
  ],
  controllers: [WeeklySummaryController],
  providers: [WeeklySummaryService],
  exports: [WeeklySummaryService],
})
export class WeeklySummaryModule {}
