import { MailServiceType, Role } from '@koh/common';
import { Injectable } from '@nestjs/common';
import { MailService } from 'mail/mail.service';
import { UserSubscriptionModel } from 'mail/user-subscriptions.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { AsyncQuestionModel } from './asyncQuestion.entity';
import { UserModel } from 'profile/user.entity';
import { AsyncQuestionCommentModel } from './asyncQuestionComment.entity';
import * as Sentry from '@sentry/nestjs';

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
      await this.mailService
        .sendEmail({
          receiver: question.creator.email,
          type: service.serviceType,
          subject: `HelpMe - ${commenterIsStaff ? commenter.name : 'Someone'} Commented on Your Anytime Question`,
          content: `<br> <b>${commenterIsStaff ? commenter.name : 'Someone'} has commented on your "${question.questionAbstract}" Anytime Question:</b> 
                <br> ${comment.commentText}
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
    const sendEmailResults = await Promise.allSettled(
      subscriptions.map((sub) =>
        this.mailService.sendEmail({
          receiver: sub.user.email,
          type: MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST,
          subject: `HelpMe - ${commenterIsStaff ? commenter.name : 'Someone'} Commented on an Anytime Question You Commented on`,
          content: `<br> <b>${commenterIsStaff ? commenter.name : 'Someone'} has commented on the "${updatedQuestion.questionAbstract}" Anytime Question:</b> 
                    <br> ${comment.commentText}
                    <br>
                    <br> Note: Do NOT reply to this email. <a href="${process.env.DOMAIN}/course/${updatedQuestion.courseId}/async_centre">View and Reply Here</a> <br>`,
        }),
      ),
    );
    // Capture any email failures in Sentry
    sendEmailResults.forEach((result) => {
      if (result.status === 'rejected') {
        Sentry.captureException(result.reason);
      }
    });
  }

  async sendNeedsAttentionEmail(question: AsyncQuestionModel) {
    // Step 1: Get all users in the course
    const usersInCourse = await UserCourseModel.createQueryBuilder('userCourse')
      .select('userCourse.userId')
      .where('userCourse.courseId = :courseId', { courseId: question.courseId })
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
    const sendEmailResults = await Promise.allSettled(
      subscriptions.map((sub) =>
        this.mailService.sendEmail({
          receiver: sub.user.email,
          type: MailServiceType.ASYNC_QUESTION_FLAGGED,
          subject: 'HelpMe - New Question Marked as Needing Attention',
          content: `<br> <b>A new question has been posted on the Anytime Question Hub and has been marked as needing attention:</b> 
                    <br> <b>Question Abstract:</b> ${question.questionAbstract}
                    <br> <b>Question Types:</b> ${question.questionTypes.map((qt) => qt.name).join(', ')}
                    <br> <b>Question Text:</b> ${question.questionText}
                    <br>
                    <br> Do NOT reply to this email. <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View and Answer It Here</a> <br>`,
        }),
      ),
    );
    // Capture any email failures in Sentry
    sendEmailResults.forEach((result) => {
      if (result.status === 'rejected') {
        Sentry.captureException(result.reason);
      }
    });
  }

  async sendQuestionAnsweredEmail(question: AsyncQuestionModel) {
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
      await this.mailService
        .sendEmail({
          receiver: question.creator.email,
          type: service.serviceType,
          subject: 'HelpMe - Your Anytime Question Has Been Answered',
          content: `<br> <b>Your question on the Anytime Question Hub has been answered or verified by staff:</b> 
              <br> ${question.answerText}
              <br> <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View Here</a> <br>`,
        })
        .catch((err) => {
          console.error('Failed to send email Human Answered email: ' + err);
          Sentry.captureException(err);
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
      await this.mailService
        .sendEmail({
          receiver: question.creator.email,
          type: service.serviceType,
          subject: 'HelpMe - Your Anytime Question Status Has Changed',
          content: `<br> <b>The status of your question on the Anytime Question Hub has been updated by a staff member:</b> 
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
    console.log('1');
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
      console.log('2');
      const service = subscription.service;
      await this.mailService
        .sendEmail({
          receiver: updatedQuestion.creator.email,
          type: service.serviceType,
          subject: 'HelpMe - Your Anytime Question Has Been Upvoted',
          content: `<br> <b>Your question on the Anytime Question Hub has received an upvote:</b> 
        <br> Question: ${updatedQuestion.questionText}
          <br> Current votes: ${updatedQuestion.votesSum}
          <br> <a href="${process.env.DOMAIN}/course/${updatedQuestion.courseId}/async_centre">View Here</a> <br>`,
        })
        .catch((err) => {
          console.error('Failed to send email Vote Question email: ' + err);
          Sentry.captureException(err);
        });
      console.log('3');
    }
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
}
