import {
  AddDocumentChunkParams,
  asyncQuestionStatus,
  CreateAsyncQuestions,
  ERROR_MESSAGES,
  MailServiceType,
  Role,
  UpdateAsyncQuestions,
} from '@koh/common';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MailService } from 'mail/mail.service';
import { UserSubscriptionModel } from 'mail/user-subscriptions.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { AsyncQuestionModel } from './asyncQuestion.entity';
import { UserModel } from 'profile/user.entity';
import { AsyncQuestionCommentModel } from './asyncQuestionComment.entity';
import * as Sentry from '@sentry/nestjs';
import { UnreadAsyncQuestionModel } from './unread-async-question.entity';
import { ChatbotApiService } from 'chatbot/chatbot-api.service';
import { AsyncQuestionImageModel } from './asyncQuestionImage.entity';
import { EntityManager, In } from 'typeorm';
import * as checkDiskSpace from 'check-disk-space';
import * as path from 'path';
import * as sharp from 'sharp';

@Injectable()
export class AsyncQuestionService {
  constructor(
    private mailService: MailService,
    private readonly chatbotApiService: ChatbotApiService,
  ) {}

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
    const sendEmailResults = await Promise.allSettled(
      subscriptions.map((sub) =>
        this.mailService.sendEmail({
          receiver: sub.user.email,
          type: MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST,
          subject: `HelpMe - ${commenterIsStaff ? commenter.name : 'Someone'} Commented on an Anytime Question You Commented on`,
          content: `<br> <b>${commenterIsStaff ? commenter.name : 'Someone'} has commented on the "${updatedQuestion.questionAbstract ?? (updatedQuestion.questionText ? updatedQuestion.questionText.slice(0, 50) : '')}" Anytime Question:</b> 
                    <br> <b>Comment Text<b>: ${comment.commentText}
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
    const sendEmailResults = await Promise.allSettled(
      subscriptions.map((sub) =>
        this.mailService.sendEmail({
          receiver: sub.user.email,
          type: MailServiceType.ASYNC_QUESTION_FLAGGED,
          subject: 'HelpMe - New Question Marked as Needing Attention',
          content: `<br> <b>A new question has been posted on the Anytime Question Hub and has been marked as needing attention:</b> 
                    <br> ${question.questionAbstract ? `<b>Question Abstract:</b> ${question.questionAbstract}` : ''}
                    <br> ${question.questionTypes?.length > 0 ? `<b>Question Types:</b> ${question.questionTypes.map((qt) => qt.name).join(', ')}` : ''}
                    <br> ${question.questionText ? `<b>Question Text:</b> ${question.questionText}` : ''}
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
          content: `<br> <b>Your question on the Anytime Question Hub has been answered or verified by staff.</b> 
              <br> <b>Answer Text:</b> ${question.answerText}
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
      await this.mailService
        .sendEmail({
          receiver: updatedQuestion.creator.email,
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
    transactionalEntityManager?: EntityManager,
  ) {
    if (transactionalEntityManager) {
      await transactionalEntityManager
        .createQueryBuilder()
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
    } else {
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
  }

  async markUnreadForAll(
    question: AsyncQuestionModel,
    userToNotNotifyId: number,
    transactionalEntityManager?: EntityManager,
  ) {
    if (transactionalEntityManager) {
      await transactionalEntityManager
        .createQueryBuilder()
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
    } else {
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

  async upsertQAToChatbot(
    question: AsyncQuestionModel,
    courseId: number,
    userToken: string,
  ) {
    const now = new Date();
    // Since the name can take up quite a bit of space, no more than 60 characters (show ... if longer)
    const chunkName = `${(question.questionAbstract ?? question.questionText).slice(0, 60)}${(question.questionAbstract ?? question.questionText).length > 60 ? '...' : ''}`;
    const chunkParams: AddDocumentChunkParams = {
      documentText: `${this.formatQuestionTextForChatbot(question, true)}\n\nAnswer: ${question.answerText}`,
      metadata: {
        name: chunkName,
        type: 'inserted_async_question',
        asyncQuestionId: question.id,
        source: `/course/${courseId}/async_centre`,
        courseId: courseId,
        firstInsertedAt: now, // note that the chatbot will ignore this field if its an update
        lastUpdatedAt: now,
        shouldProbablyKeepWhenCloning: true,
      },
    };
    await this.chatbotApiService.addDocumentChunk(
      chunkParams,
      courseId,
      userToken,
    );
  }

  /* Just for formatting the details of the question for sending to the chatbot or for a chunk. 
  Does stuff like if there's only an abstract, the abstract will just be called "Question" instead of having "Question Abstract" and "Question Text"
  */
  formatQuestionTextForChatbot(
    question: AsyncQuestionModel,
    includeImageDescriptions = false, // unused atm
  ) {
    return `${question.questionText ? `Question Abstract: ${question.questionAbstract}` : `Question: ${question.questionAbstract}`}
  ${question.questionText ? `Question Text: ${question.questionText}` : ''}
  ${question.questionTypes && question.questionTypes.length > 0 ? `Question Types: ${question.questionTypes.map((questionType) => questionType.name).join(', ')}` : ''}
  ${includeImageDescriptions ? `Question Image Descriptions: ${question.images.map((image, idx) => `Image ${idx + 1}: ${image.aiSummary}`).join('\n')}` : ''}
`;
  }

  async createAsyncQuestion(
    questionData: Partial<AsyncQuestionModel>,
    imageBuffers: tempFile[],
    transactionalEntityManager: EntityManager,
  ): Promise<AsyncQuestionModel> {
    // Create the question first
    const question = await transactionalEntityManager.save(
      AsyncQuestionModel.create(questionData),
    );

    // Process and save images
    await this.saveImagesToDb(
      question,
      imageBuffers,
      transactionalEntityManager,
    );

    return question;
  }

  async saveImagesToDb(
    question: AsyncQuestionModel,
    imageBuffers: tempFile[],
    transactionalEntityManager: EntityManager,
  ) {
    // Check disk space before proceeding
    const spaceLeft = await checkDiskSpace(path.parse(process.cwd()).root);
    if (spaceLeft.free < 1_000_000_000) {
      throw new ServiceUnavailableException(ERROR_MESSAGES.common.noDiskSpace);
    }
    const startTime = Date.now();

    // Process and save images
    if (imageBuffers.length > 0) {
      const imagePromises = imageBuffers.map(async (buffer) => {
        const imageModel = new AsyncQuestionImageModel();
        imageModel.asyncQuestion = question;
        imageModel.imageBuffer = buffer.processedBuffer;
        imageModel.previewImageBuffer = buffer.previewBuffer;
        imageModel.imageSizeBytes = buffer.processedBuffer.length;
        imageModel.previewImageSizeBytes = buffer.previewBuffer.length;

        imageModel.originalFileName = buffer.originalFileName;
        imageModel.newFileName = buffer.newFileName;

        const image = await transactionalEntityManager.save(imageModel);
        buffer.imageId = image.imageId; // add the image id to the buffer so we can use it later (for passing to chatbot)

        return buffer;
      });

      await Promise.all(imagePromises);
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    if (processingTime > 10000) {
      // more than 10 seconds
      console.error(`saveImagesToDb took too long: ${processingTime}ms`);
    }
  }

  async deleteImages(
    questionId: number,
    imageIds: number[],
    transactionalEntityManager: EntityManager,
  ) {
    await transactionalEntityManager.delete(AsyncQuestionImageModel, {
      imageId: In(imageIds),
      asyncQuestionId: questionId,
    });
  }

  async saveImageDescriptions(
    imageDescriptions: { imageId: string; description: string }[],
    transactionalEntityManager: EntityManager,
  ) {
    // map over imageDescriptions and update the images with the descriptions
    for (const imageDescription of imageDescriptions) {
      if (
        Number.isInteger(imageDescription.imageId) &&
        Number(imageDescription.imageId) > 0
      ) {
        await transactionalEntityManager.update(
          AsyncQuestionImageModel,
          {
            // using .update() instead of .save() so we don't have to load the image into memory again
            imageId: Number(imageDescription.imageId),
          },
          {
            aiSummary: imageDescription.description,
          },
        );
      }
    }
  }

  async convertAndResizeImages(
    images: Express.Multer.File[],
  ): Promise<tempFile[]> {
    const startTime = Date.now();
    const results = await Promise.all(
      images.map(async (image) => {
        // create both full and preview versions (the preview version is much smaller), they all get converted to webp
        const [processedBuffer, previewBuffer] = await Promise.all([
          sharp(image.buffer)
            .resize(1920, 1080, {
              fit: 'inside', // resize to fit within 1920x1080, but keep aspect ratio
              withoutEnlargement: true, // don't enlarge the image
            })
            .webp({ quality: 80 }) // convert to webp with quality 80
            .toBuffer(),
          sharp(image.buffer) // preview images get sent first so they need to be low quality so they get sent fast.
            .resize(400, 300, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 30 })
            .toBuffer(),
        ]);

        // Remove the original extension and replace with .webp
        const sanitizedFilename =
          image.originalname
            .replace(/[/\\?%*:|"<>]/g, '_') // Replace unsafe characters with underscores
            .replace(/\.[^/.]+$/, '') // Remove the original extension
            .trim() + '.webp'; // Add .webp extension

        return {
          processedBuffer,
          previewBuffer,
          originalFileName: image.originalname,
          newFileName: sanitizedFilename,
        };
      }),
    );

    const endTime = Date.now();
    const processingTime = endTime - startTime;
    if (processingTime > 10000) {
      // more than 10 seconds
      console.error(
        `convertAndResizeImages took too long: ${processingTime}ms`,
      );
    }

    return results;
  }

  async getImageById(
    imageId: number,
    preview: boolean,
  ): Promise<{
    buffer: Buffer;
    contentType: string;
    newFileName: string;
  } | null> {
    let image;
    if (preview) {
      image = await AsyncQuestionImageModel.findOne({
        where: { imageId },
        select: ['previewImageBuffer', 'newFileName'],
      });
    } else {
      image = await AsyncQuestionImageModel.findOne({
        where: { imageId },
        select: ['imageBuffer', 'newFileName'],
      });
    }

    if (!image) return null;

    return {
      buffer: preview ? image.previewImageBuffer : image.imageBuffer,
      contentType: 'image/webp',
      newFileName: image.newFileName,
    };
  }

  async getCurrentImageCount(
    questionId: number,
    transactionalEntityManager: EntityManager,
  ) {
    return await transactionalEntityManager.count(AsyncQuestionImageModel, {
      where: { asyncQuestionId: questionId },
    });
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

  validateBodyCreateAsyncQuestions(
    body: CreateAsyncQuestions | FormData | any,
  ) {
    // the body *should* follow CreateAsyncQuestions, but since we're using formdata, we have to manually parse the fields and validate them
    if (body.questionTypes) {
      try {
        body.questionTypes = JSON.parse(body.questionTypes);
      } catch (error) {
        throw new BadRequestException(
          'Question Types field must be a valid JSON array',
        );
      }
    }
    if (!body.questionAbstract) {
      throw new BadRequestException('Question Abstract is required');
    }
    body.questionText = body.questionText ? body.questionText.toString() : '';
    body.questionAbstract = body.questionAbstract
      ? body.questionAbstract.toString()
      : '';
    body.status = body.status
      ? body.status.toString()
      : asyncQuestionStatus.AIAnswered;
  }

  validateBodyUpdateAsyncQuestions(
    body: UpdateAsyncQuestions | FormData | any,
  ) {
    // the body *should* follow UpdateAsyncQuestions, but since we're using formdata, we have to manually parse the fields and validate them
    if (body.questionTypes) {
      try {
        body.questionTypes = JSON.parse(body.questionTypes);
      } catch (error) {
        throw new BadRequestException(
          'Question Types field must be a valid JSON array',
        );
      }
    }

    body.questionText = body.questionText ? body.questionText.toString() : '';
    body.questionAbstract = body.questionAbstract
      ? body.questionAbstract.toString()
      : '';
    body.status = body.status
      ? body.status.toString()
      : asyncQuestionStatus.AIAnswered;

    if (body.deletedImageIds) {
      try {
        body.deletedImageIds = JSON.parse(body.deletedImageIds);
      } catch (error) {
        throw new BadRequestException(
          'Delete Image Ids field must be a valid JSON array',
        );
      }
    }

    // if you created the question (i.e. a student), you can't update the status to illegal ones
    if (
      body.status === asyncQuestionStatus.TADeleted ||
      body.status === asyncQuestionStatus.HumanAnswered
    ) {
      throw new ForbiddenException(
        `You cannot update your own question's status to ${body.status}`,
      );
    }

    if (body.refreshAIAnswer) {
      body.refreshAIAnswer = body.refreshAIAnswer.toString() === 'true';
    }
  }
}

export interface tempFile {
  processedBuffer: Buffer;
  previewBuffer: Buffer;
  originalFileName: string;
  newFileName: string;
  imageId?: number;
}
