import { MailServiceType, parseThinkBlock, Role } from '@koh/common';
import { Injectable } from '@nestjs/common';
import { MailService } from 'mail/mail.service';
import { UserSubscriptionModel } from 'mail/user-subscriptions.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { AsyncQuestionModel } from './asyncQuestion.entity';
import { UserModel } from 'profile/user.entity';
import { AsyncQuestionCommentModel } from './asyncQuestionComment.entity';
import * as Sentry from '@sentry/nestjs';
import { UnreadAsyncQuestionModel } from './unread-async-question.entity';
import { CourseSettingsModel } from '../course/course_settings.entity';
import { SentEmailModel } from '../mail/sent-email.entity';

@Injectable()
export class AsyncQuestionService {
  constructor(private mailService: MailService) {}

  async sendNewCommentOnMyQuestionEmail(
    commenter: UserModel,
    commenterRole: Role,
    question: AsyncQuestionModel,
    comment: AsyncQuestionCommentModel,
  ) {
    if (!question.creator) {
      return;
    }
    const subscription = await UserSubscriptionModel.findOne({
      where: {
        userId: question.creator.id,
        isSubscribed: true,
        service: {
          serviceType: MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_MY_POST,
        },
      },
      relations: ['service'],
    });
    if (subscription) {
      const commenterIsStaff =
        commenterRole === Role.TA || commenterRole === Role.PROFESSOR;
      const service = subscription.service;
      // note: not awaiting since it can take a moment to send emails
      this.mailService
        .sendEmail({
          receiverOrReceivers: question.creator.email,
          type: service.serviceType,
          subject: `HelpMe - ${commenterIsStaff ? commenter.name : 'Someone'} Commented on Your Anytime Question`,
          content: `<br> <b>${commenterIsStaff ? commenter.name : 'Someone'} has commented on your "${question.questionAbstract ?? (question.questionText ? question.questionText.slice(0, 50) : '')}" Anytime Question:</b> 
                <br> <b>Comment Text<b>: ${comment.commentText}
                <br>
                <br> Note: Do NOT reply to this email. <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View and Reply Here</a> <br>`,
        })
        .catch((err) => {
          console.error(
            'Failed to send email Post Comment (on my post) email: ' + err,
          );
          Sentry.captureException(err);
        });
    }
  }

  /*send emails out to all users that have posted a comment on this question.
      Note that updatedQuestion must have comments and comments.creator relations
      */
  async sendNewCommentOnOtherQuestionEmail(
    commenter: UserModel,
    commenterRole: Role,
    questionCreatorId: number,
    updatedQuestion: AsyncQuestionModel,
    comment: AsyncQuestionCommentModel,
  ) {
    // first make a list of userIds of all users that have posted a comment on this question (excluding the user that just posted the comment and the question creator)
    const userIds = updatedQuestion.comments
      .filter(
        (comment) =>
          comment.creator.id !== commenter.id &&
          comment.creator.id !== questionCreatorId,
      )
      .map((comment) => comment.creator.id);
    if (userIds.length === 0) {
      return;
    }
    // Now get subscriptions for these users
    const subscriptions = await UserSubscriptionModel.createQueryBuilder(
      'subscription',
    )
      .innerJoinAndSelect('subscription.user', 'user')
      .innerJoinAndSelect('subscription.service', 'service')
      .where('subscription.userId IN (:...userIds)', { userIds })
      .andWhere('service.serviceType = :serviceType', {
        serviceType: MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST,
      })
      .andWhere('subscription.isSubscribed = true')
      .getMany();
    // Send emails in parallel
    const commenterIsStaff =
      commenterRole === Role.TA || commenterRole === Role.PROFESSOR;
    // note: not awaiting since it can take a moment to send emails
    Promise.allSettled(
      subscriptions.map((sub) =>
        this.mailService.sendEmail({
          receiverOrReceivers: sub.user.email,
          type: MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST,
          subject: `HelpMe - ${commenterIsStaff ? commenter.name : 'Someone'} Commented on an Anytime Question You Commented on`,
          content: `<br> <b>${commenterIsStaff ? commenter.name : 'Someone'} has commented on the "${updatedQuestion.questionAbstract ?? (updatedQuestion.questionText ? updatedQuestion.questionText.slice(0, 50) : '')}" Anytime Question:</b> 
                    <br> <b>Comment Text<b>: ${comment.commentText}
                    <br>
                    <br> Note: Do NOT reply to this email. <a href="${process.env.DOMAIN}/course/${updatedQuestion.courseId}/async_centre">View and Reply Here</a> <br>`,
        }),
      ),
    ).then((sendEmailResults) => {
      // Capture any email failures in Sentry
      sendEmailResults.forEach((result) => {
        if (result.status === 'rejected') {
          Sentry.captureException(result.reason);
        }
      });
    });
  }

  async sendNeedsAttentionEmail(question: AsyncQuestionModel) {
    // Step 1: Get all staff members in the course
    const usersInCourse = await UserCourseModel.createQueryBuilder('userCourse')
      .select('userCourse.userId')
      .where('userCourse.courseId = :courseId', { courseId: question.courseId })
      .andWhere('userCourse.role IN (:...roles)', {
        roles: [Role.PROFESSOR, Role.TA],
      })
      .getMany();

    const userIds = usersInCourse.map((uc) => uc.userId);
    if (userIds.length === 0) {
      return;
    }

    // Step 2: Get subscriptions for these users
    const subscriptions = await UserSubscriptionModel.createQueryBuilder(
      'subscription',
    )
      .innerJoinAndSelect('subscription.user', 'user')
      .innerJoinAndSelect('subscription.service', 'service')
      .where('subscription.userId IN (:...userIds)', { userIds })
      .andWhere('service.serviceType = :serviceType', {
        serviceType: MailServiceType.ASYNC_QUESTION_FLAGGED,
      })
      .andWhere('subscription.isSubscribed = true')
      .getMany();

    // Send emails in parallel
    // note: not awaiting since it can take a moment to send emails

    if (subscriptions.length == 0) return;

    this.mailService
      .sendEmail({
        receiverOrReceivers: subscriptions.map((s) => s.user.email),
        type: MailServiceType.ASYNC_QUESTION_FLAGGED,
        subject: 'HelpMe - New Question Marked as Needing Attention',
        content: `<br> <b>A new question has been posted on the Anytime Question Hub and has been marked as needing attention:</b> 
                    <br> ${question.questionAbstract ? `<b>Question Abstract:</b> ${question.questionAbstract}` : ''}
                    <br> ${question.questionTypes?.length > 0 ? `<b>Question Types:</b> ${question.questionTypes.map((qt) => qt.name).join(', ')}` : ''}
                    <br> ${question.questionText ? `<b>Question Text:</b> ${question.questionText}` : ''}
                    <br>
                    <br> Do NOT reply to this email. <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View and Answer It Here</a> <br>`,
        track: true,
        metadata: {
          asyncQuestionId: question.id,
        },
      })
      .catch((err) => Sentry.captureException(err));
  }

  async sendQuestionAnsweredEmails(question: AsyncQuestionModel) { // also needs an update for the method call in asyncQuestion.controller.ts
    await this.sendQuestionAnsweredFollowup(question).catch((err) => {
      console.error(err);
      Sentry.captureException(err);
    });

    const subscription = await UserSubscriptionModel.findOne({
      where: {
        userId: question.creator.id,
        isSubscribed: true,
        service: {
          serviceType: MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED,
        },
      },
      relations: ['service'],
    });

    if (subscription) {
      const service = subscription.service;

      const { cleanAnswer } = parseThinkBlock(question.answerText);
      this.mailService
        .sendEmail({
          receiverOrReceivers: question.creator.email,
          type: service.serviceType,
          subject: 'HelpMe - Your Anytime Question Has Been Answered',
          content: `<br> <b>Your question on the Anytime Question Hub has been answered or verified by staff.</b> 
              <br> <b>Answer Text:</b> ${cleanAnswer}
              <br> <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View Here</a> <br>`,
        })
        .catch((err) => {
          console.error('Failed to send email Human Answered email: ' + err);
          Sentry.captureException(err);
        });
    }
  }

  async sendQuestionAnsweredFollowup(question: AsyncQuestionModel) {
    const needsAttentionEmails = await SentEmailModel.createQueryBuilder('se')
      .select()
      .where('se.serviceType = :serviceType', {
        serviceType: MailServiceType.ASYNC_QUESTION_FLAGGED,
      })
      .andWhere('se.metadata @> :metadata', {
        metadata: { asyncQuestionId: question.id },
      })
      .getMany();

    if (needsAttentionEmails.length > 0) {
      Promise.allSettled([
        needsAttentionEmails.map(async (email) =>
          this.mailService.replyToSentEmail(
            email,
            `<br> <b>This is a follow-up notice. The anytime question referenced by the previous email has now received an answer.</b>
           <br> No further intervention is required at this time.
           <br> 
           <br> The answer:
           <br> ${question.answerText}
           <br>
           <br> Do NOT reply to this email. <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View It Here</a> <br>`,
          ),
        ),
      ]).then((results) => {
        for (const result of results) {
          if (result.status == 'rejected') {
            Sentry.captureException(result.reason);
          }
        }
      });
    }
  }

  /* Not really used right now since the only status that staff can change is changing it to "Human Answered" */
  async sendGenericStatusChangeEmail(
    question: AsyncQuestionModel,
    status: string,
  ) {
    //send generic your async question changed.
    const statusChangeSubscription = await UserSubscriptionModel.findOne({
      where: {
        userId: question.creator.id,
        isSubscribed: true,
        service: {
          serviceType: MailServiceType.ASYNC_QUESTION_STATUS_CHANGED,
        },
      },
      relations: ['service'],
    });

    if (statusChangeSubscription) {
      const service = statusChangeSubscription.service;
      // note: not awaiting since it can take a moment to send emails
      this.mailService
        .sendEmail({
          receiverOrReceivers: question.creator.email,
          type: service.serviceType,
          subject: 'HelpMe - Your Anytime Question Status Has Changed',
          content: `<br> <b>The status of your question on the Anytime Question Hub has been updated by a staff member.</b> 
                  <br> New status: ${status}
                  <br> <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View Here</a> <br>`,
        })
        .catch((err) => {
          console.error('Failed to send email Status Changed email: ' + err);
          Sentry.captureException(err);
        });
    }
  }

  async sendUpvotedEmail(updatedQuestion: AsyncQuestionModel) {
    const subscription = await UserSubscriptionModel.findOne({
      where: {
        userId: updatedQuestion.creator.id,
        isSubscribed: true,
        service: {
          serviceType: MailServiceType.ASYNC_QUESTION_UPVOTED,
        },
      },
      relations: ['service'],
    });

    if (subscription) {
      const service = subscription.service;
      // note: not awaiting since it can take a moment to send emails
      this.mailService
        .sendEmail({
          receiverOrReceivers: updatedQuestion.creator.email,
          type: service.serviceType,
          subject: 'HelpMe - Your Anytime Question Has Been Upvoted',
          content: `<br> <b>Your question on the Anytime Question Hub has received an upvote.</b> 
        <br> Question: ${updatedQuestion.questionText ?? updatedQuestion.questionAbstract ?? ''}
          <br> Current votes: ${updatedQuestion.votesSum}
          <br> <a href="${process.env.DOMAIN}/course/${updatedQuestion.courseId}/async_centre">View Here</a> <br>`,
        })
        .catch((err) => {
          console.error('Failed to send email Vote Question email: ' + err);
          Sentry.captureException(err);
        });
    }
  }

  async createUnreadNotificationsForQuestion(question: AsyncQuestionModel) {
    const usersInCourse = await UserCourseModel.find({
      where: { courseId: question.courseId },
    });

    if (usersInCourse?.length) {
      await UnreadAsyncQuestionModel.createQueryBuilder()
        .insert()
        .into(UnreadAsyncQuestionModel)
        .values(
          usersInCourse.map((userCourse) => ({
            userId: userCourse.userId,
            courseId: question.courseId,
            asyncQuestion: question,
            readLatest:
              userCourse.userId === question.creatorId ||
              userCourse.role === Role.STUDENT, // if you're the creator or a student, don't mark as unread because not yet visible
          })),
        )
        .execute();
    }
  }

  async markUnreadForRoles(
    question: AsyncQuestionModel,
    roles: Role[],
    userToNotNotifyId: number,
  ) {
    await UnreadAsyncQuestionModel.createQueryBuilder()
      .update(UnreadAsyncQuestionModel)
      .set({ readLatest: false })
      .where('asyncQuestionId = :asyncQuestionId', {
        asyncQuestionId: question.id,
      })
      .andWhere('userId != :userId', { userId: userToNotNotifyId }) // don't notify me (person who called endpoint)
      // Use a subquery to filter by roles
      .andWhere(
        `"userId" IN (
           SELECT "user_course_model"."userId"
           FROM "user_course_model"
           WHERE "user_course_model"."role" IN (:...roles)
        )`,
        { roles }, // notify all specified roles
      )
      .execute();
  }

  async markUnreadForAll(
    question: AsyncQuestionModel,
    userToNotNotifyId: number,
  ) {
    await UnreadAsyncQuestionModel.createQueryBuilder()
      .update(UnreadAsyncQuestionModel)
      .set({ readLatest: false })
      .where('asyncQuestionId = :asyncQuestionId', {
        asyncQuestionId: question.id,
      })
      .andWhere(
        `userId != :userId`,
        { userId: userToNotNotifyId }, // don't notify me (person who called endpoint)
      )
      .execute();
  }

  async markUnreadForCreator(question: AsyncQuestionModel) {
    await UnreadAsyncQuestionModel.createQueryBuilder()
      .update(UnreadAsyncQuestionModel)
      .set({ readLatest: false })
      .where('asyncQuestionId = :asyncQuestionId', {
        asyncQuestionId: question.id,
      })
      .andWhere(
        `userId = :userId`,
        { userId: question.creatorId }, // notify ONLY question creator
      )
      .execute();
  }

  /**
   * Takes in a userId and async questionId and hashes them to return a random index from ANONYMOUS_ANIMAL_AVATAR.ANIMAL_NAMES
   * Note that 70 is the length of ANONYMOUS_ANIMAL_AVATAR.ANIMAL_NAMES
   * I have opted to hard-code it since I don't want to put that giant array here and it's unlikely to change
   */
  getAnonId(userId: number, questionId: number) {
    const hash = userId + questionId;
    return hash % 70;
  }

  async isVisible(
    asyncQuestion: AsyncQuestionModel,
    courseSettings?: CourseSettingsModel,
  ) {
    if (!courseSettings) {
      courseSettings = await CourseSettingsModel.findOne({
        where: { courseId: asyncQuestion.id },
      });
    }
    return (courseSettings?.asyncCentreAuthorPublic ?? false)
      ? (asyncQuestion.staffSetVisible == null &&
          asyncQuestion.authorSetVisible) ||
          asyncQuestion.staffSetVisible
      : asyncQuestion.staffSetVisible;
  }
}
