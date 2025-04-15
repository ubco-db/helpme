import {
  CreateAsyncQuestions,
  ERROR_MESSAGES,
  Role,
  AsyncQuestionParams,
  asyncQuestionStatus,
  UpdateAsyncQuestions,
  AsyncQuestionCommentParams,
  AsyncQuestion,
  nameToRGB,
  AsyncCreator,
  UnreadAsyncQuestionResponse,
} from '@koh/common';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Query,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Roles } from '../decorators/roles.decorator';
import { User, UserId } from '../decorators/user.decorator';
import { AsyncQuestionModel } from './asyncQuestion.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { Response } from 'express';
import { AsyncQuestionVotesModel } from './asyncQuestionVotes.entity';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { RedisQueueService } from '../redisQueue/redis-queue.service';
import { AsyncQuestionCommentModel } from './asyncQuestionComment.entity';
import { CourseRolesGuard } from 'guards/course-roles.guard';
import { AsyncQuestionRolesGuard } from 'guards/async-question-roles.guard';
import { pick } from 'lodash';
import { UserModel } from 'profile/user.entity';
import { getManager, In, Not } from 'typeorm';
import { ApplicationConfigService } from '../config/application_config.service';
import { ChatbotApiService } from 'chatbot/chatbot-api.service';
import { AsyncQuestionService, tempFile } from './asyncQuestion.service';
import { UnreadAsyncQuestionModel } from './unread-async-question.entity';
import { FilesInterceptor } from '@nestjs/platform-express';
import { QuestionTypeModel } from 'questionType/question-type.entity';
import { AsyncQuestionImageModel } from './asyncQuestionImage.entity';

@Controller('asyncQuestions')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class asyncQuestionController {
  constructor(
    private readonly redisQueueService: RedisQueueService,
    private readonly appConfig: ApplicationConfigService,
    private readonly asyncQuestionService: AsyncQuestionService,
    private readonly chatbotApiService: ChatbotApiService,
  ) {}

  @Post('vote/:qid/:vote')
  @UseGuards(AsyncQuestionRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async voteQuestion(
    @Param('qid', ParseIntPipe) qid: number,
    @Param('vote', ParseIntPipe) vote: number,
    @UserId() userId: number,
    @Res() res: Response,
  ): Promise<Response> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: qid },
    });

    if (!question) {
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: ERROR_MESSAGES.questionController.notFound });
      return;
    }

    let thisUserThisQuestionVote = await AsyncQuestionVotesModel.findOne({
      where: { userId, questionId: qid },
    });

    const hasVoted = thisUserThisQuestionVote !== undefined;
    const sumVotes = thisUserThisQuestionVote?.vote ?? 0;

    const newValue = sumVotes + vote;

    const canVote = newValue === 0 || newValue === 1 || newValue === -1;
    if (!canVote) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Invalid Vote (the new value must be 0, 1, or -1)' });
      return;
    }
    if (hasVoted) {
      thisUserThisQuestionVote.vote = newValue;
    } else {
      thisUserThisQuestionVote = new AsyncQuestionVotesModel();
      thisUserThisQuestionVote.userId = userId;
      thisUserThisQuestionVote.question = question;
      thisUserThisQuestionVote.vote = newValue;
    }

    await thisUserThisQuestionVote.save();

    const updatedQuestion = await AsyncQuestionModel.findOne({
      where: { id: qid },
      relations: [
        'creator',
        'taHelped',
        'votes',
        'comments',
        'comments.creator',
        'comments.creator.courses',
        'images',
      ],
    });

    await this.redisQueueService.updateAsyncQuestion(
      `c:${updatedQuestion.courseId}:aq`,
      updatedQuestion,
    );

    // Check if the question was upvoted and send email if subscribed
    if (newValue === 1 && userId !== updatedQuestion.creator.id) {
      await this.asyncQuestionService.sendUpvotedEmail(updatedQuestion);
    }

    return res.status(HttpStatus.OK).send({
      questionSumVotes: updatedQuestion.votesSum,
      vote: thisUserThisQuestionVote?.vote ?? 0,
    });
  }

  @Post(':cid')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR) // we let staff post questions too since they might want to use the system for demonstration purposes
  @UseInterceptors(
    FilesInterceptor('images', 8, {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit per file
      },
      fileFilter: (req, file, cb) => {
        // Check mimetype (it can be spoofed fyi so we also need to check the file extension)
        if (!file.mimetype.startsWith('image/')) {
          cb(new Error('Only image files are allowed'), false);
          return;
        }
        // Check file extension
        const allowedExtensions = [
          '.jpg',
          '.jpeg',
          '.png',
          '.gif',
          '.webp',
          '.bmp',
          '.svg',
          '.tiff',
          '.gif',
        ];
        const fileExt = file.originalname
          .toLowerCase()
          .substring(file.originalname.lastIndexOf('.'));
        if (!allowedExtensions.includes(fileExt)) {
          cb(new Error('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async createQuestion(
    @Body() body: CreateAsyncQuestions | FormData | any, // delete FormData | any for better type checking temporarily
    @Param('cid', ParseIntPipe) cid: number,
    @User(['chat_token']) user: UserModel,
    @Res() res: Response,
    @UploadedFiles() images?: Express.Multer.File[],
  ): Promise<AsyncQuestionModel> {
    this.asyncQuestionService.validateBodyCreateAsyncQuestions(body); // note that this *will* mutate body

    // Convert & resize images to buffers if they exist
    let processedImageBuffers: tempFile[] = [];
    if (images && images.length > 0) {
      processedImageBuffers =
        await this.asyncQuestionService.convertAndResizeImages(images);
    }

    let questionId: number | null = null;
    const entityManager = getManager();
    await entityManager.transaction(async (transactionalEntityManager) => {
      /* order:
      1. create the question to get async question id
      2. save the images to the database to get their ids
      3. query the chatbot to get the ai answer and the image summaries
      4. update the question with the ai answer and the images with their summaries
      */
      const question = await this.asyncQuestionService.createAsyncQuestion(
        // this also saves the images to the db
        {
          courseId: cid,
          creatorId: user.id,
          questionAbstract: body.questionAbstract,
          questionText: body.questionText || null,
          answerText: '', // both start as an empty string
          aiAnswerText: '',
          questionTypes: body.questionTypes as QuestionTypeModel[],
          status: body.status || asyncQuestionStatus.AIAnswered,
          visible: false,
          verified: false,
          createdAt: new Date(),
        },
        processedImageBuffers,
        transactionalEntityManager,
      );
      // now that we have the images, their ids, and the rest of the question, query the chatbot to get both the ai answer and the image summaries (and then store everything in the db)
      let aiAnswerText: string | null = null;
      if (user.chat_token.used >= user.chat_token.max_uses) {
        aiAnswerText =
          'All AI uses have been used up for today. Please try again tomorrow.';
      } else {
        const chatbotResponse = await this.chatbotApiService.askQuestion(
          this.asyncQuestionService.formatQuestionTextForChatbot(
            question,
            false,
          ),
          [],
          user.chat_token.token,
          cid,
          processedImageBuffers,
          true,
        );
        aiAnswerText = chatbotResponse.answer;
        const imageDescriptions = chatbotResponse.imageDescriptions;

        // update the question with the ai answer text
        question.aiAnswerText = aiAnswerText;
        question.answerText = aiAnswerText; // answer text initially becomes the ai answer text (staff can later edit it)
        await transactionalEntityManager.save(question);

        await this.asyncQuestionService.saveImageDescriptions(
          imageDescriptions,
          transactionalEntityManager,
        );
      }
      questionId = question.id;
    });

    if (!questionId) {
      throw new InternalServerErrorException('Failed to create question');
    }

    const newQuestion = await AsyncQuestionModel.findOne({
      where: {
        courseId: cid,
        id: questionId,
      },
      relations: [
        'creator',
        'taHelped',
        'votes',
        'comments',
        'comments.creator',
        'comments.creator.courses',
        'images',
      ],
    });

    await this.redisQueueService.addAsyncQuestion(`c:${cid}:aq`, newQuestion);
    await this.asyncQuestionService.createUnreadNotificationsForQuestion(
      newQuestion,
    );

    res.status(HttpStatus.CREATED).send(newQuestion);
    return;
  }

  @Patch('student/:questionId')
  @UseGuards(AsyncQuestionRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR) // since were letting staff post questions, they might end up calling this endpoint to update their own questions
  @UseInterceptors(
    FilesInterceptor('newImages', 8, {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit per file
      },
      fileFilter: (req, file, cb) => {
        // Check mimetype (it can be spoofed fyi so we also need to check the file extension)
        if (!file.mimetype.startsWith('image/')) {
          cb(new Error('Only image files are allowed'), false);
          return;
        }
        // Check file extension
        const allowedExtensions = [
          '.jpg',
          '.jpeg',
          '.png',
          '.gif',
          '.webp',
          '.bmp',
          '.svg',
          '.tiff',
          '.gif',
        ];
        const fileExt = file.originalname
          .toLowerCase()
          .substring(file.originalname.lastIndexOf('.'));
        if (!allowedExtensions.includes(fileExt)) {
          cb(new Error('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async updateQuestionStudent(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: UpdateAsyncQuestions | FormData | any, // delete FormData | any for better type checking temporarily
    @User(['chat_token']) user: UserModel,
    @UploadedFiles() newImages?: Express.Multer.File[],
  ): Promise<AsyncQuestionParams> {
    this.asyncQuestionService.validateBodyUpdateAsyncQuestions(body); // note that this *will* mutate body

    let question: AsyncQuestionModel | null = null;
    const entityManager = getManager();
    await entityManager.transaction(async (transactionalEntityManager) => {
      question = await transactionalEntityManager.findOne(AsyncQuestionModel, {
        where: { id: questionId },
        relations: [
          'creator',
          'votes',
          'comments',
          'comments.creator',
          'comments.creator.courses',
        ],
      });
      if (!question) {
        throw new NotFoundException('Question Not Found');
      }
      if (question.creatorId !== user.id) {
        throw new ForbiddenException('You can only update your own questions');
      }

      // deep copy question since it changes
      const oldQuestion: AsyncQuestionModel = JSON.parse(
        JSON.stringify(question),
      );
      // this doesn't include if question types have changed but meh
      const isChangingQuestion =
        question.questionText !== oldQuestion.questionText ||
        question.questionAbstract !== oldQuestion.questionAbstract ||
        (newImages && newImages.length > 0) ||
        (body.deletedImageIds && body.deletedImageIds.length > 0);

      // if they're changing the status to needs attention, send the email but don't change anything else
      if (
        body.status === asyncQuestionStatus.AIAnsweredNeedsAttention &&
        question.status != asyncQuestionStatus.AIAnsweredNeedsAttention
      ) {
        await this.asyncQuestionService.sendNeedsAttentionEmail(question);
        // Mark as new unread for all staff if the question needs attention
        await this.asyncQuestionService.markUnreadForRoles(
          question,
          [Role.TA, Role.PROFESSOR],
          user.id,
          transactionalEntityManager,
        );
      } else {
        // Update allowed fields
        Object.keys(body).forEach((key) => {
          if (
            body[key] !== undefined &&
            body[key] !== null &&
            question[key] !== undefined
          ) {
            question[key] = body[key];
          }
        });

        // delete any images that are in the deletedImageIds array
        if (body.deletedImageIds && body.deletedImageIds.length > 0) {
          await this.asyncQuestionService.deleteImages(
            questionId,
            body.deletedImageIds,
            transactionalEntityManager,
          );
        }

        // Convert & resize images to buffers if they exist
        let processedImageBuffers: tempFile[] = [];
        if (newImages && newImages.length > 0) {
          const currentImageCount =
            await this.asyncQuestionService.getCurrentImageCount(
              questionId,
              transactionalEntityManager,
            );
          if (currentImageCount + newImages.length > 8) {
            throw new BadRequestException(
              'You can have at most 8 images uploaded per question',
            );
          }
          processedImageBuffers =
            await this.asyncQuestionService.convertAndResizeImages(newImages);
          // save the images to the db (while also setting the imageIds of processedImageBuffers)
          await this.asyncQuestionService.saveImagesToDb(
            question,
            processedImageBuffers,
            transactionalEntityManager,
          );
        }

        if (body.refreshAIAnswer) {
          if (user.chat_token.used >= user.chat_token.max_uses) {
            question.aiAnswerText =
              'All AI uses have been used up for today. Please try again tomorrow.';
            question.answerText =
              'All AI uses have been used up for today. Please try again tomorrow.';
          } else {
            // before we ask the chatbot, we need to gather any previously uploaded images from the database and append them onto processedImageBuffers
            const alreadyProcessedImageIds = processedImageBuffers.map(
              (image) => image.imageId,
            );
            const images = await transactionalEntityManager.find(
              AsyncQuestionImageModel,
              {
                where: {
                  asyncQuestionId: questionId,
                  imageId: Not(In(alreadyProcessedImageIds)), // don't retrieve from the db the image buffers we just uploaded to it (to save memory)
                },
                select: ['imageBuffer', 'newFileName', 'imageId'], // not including the old aiSummaries since getting a new description for them may give a better ai answer
              },
            );
            processedImageBuffers.push(
              ...images.map((image) => ({
                processedBuffer: image.imageBuffer,
                previewBuffer: image.imageBuffer, // unused. Didn't want to include it in the query so that less memory is used
                originalFileName: image.originalFileName,
                newFileName: image.newFileName,
                imageId: image.imageId,
              })),
            );

            const chatbotResponse = await this.chatbotApiService.askQuestion(
              this.asyncQuestionService.formatQuestionTextForChatbot(
                question,
                false,
              ),
              [],
              user.chat_token.token,
              question.courseId,
              processedImageBuffers,
              true,
            );
            question.aiAnswerText = chatbotResponse.answer;
            question.answerText = chatbotResponse.answer;
            await this.asyncQuestionService.saveImageDescriptions(
              chatbotResponse.imageDescriptions,
              transactionalEntityManager,
            );
          }
        }
        // save the changes
        await transactionalEntityManager.save(question);

        // re-fetch the updated question
        const updatedQuestion = await transactionalEntityManager.findOne(
          AsyncQuestionModel,
          {
            where: { id: questionId },
            relations: [
              'creator',
              'votes',
              'comments',
              'comments.creator',
              'comments.creator.courses',
              'images',
            ],
          },
        );
        // if the question is visible and they rewrote their question and got a new answer text, mark it as unread for everyone
        if (
          updatedQuestion.visible &&
          body.refreshAIAnswer &&
          isChangingQuestion
        ) {
          await this.asyncQuestionService.markUnreadForAll(
            updatedQuestion,
            user.id,
            transactionalEntityManager,
          );
        }

        if (body.status === asyncQuestionStatus.StudentDeleted) {
          await this.redisQueueService.deleteAsyncQuestion(
            `c:${question.courseId}:aq`,
            updatedQuestion,
          );
          // delete all unread notifications for this question
          await UnreadAsyncQuestionModel.delete({
            asyncQuestionId: questionId,
          });
        } else {
          await this.redisQueueService.updateAsyncQuestion(
            `c:${question.courseId}:aq`,
            updatedQuestion,
          );
        }
        delete question.taHelped;
        delete question.votes;
      }
    });
    return question;
  }

  // check that verified equals true and something changed
  @Patch('faculty/:questionId')
  @UseGuards(AsyncQuestionRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async updateQuestionStaff(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: UpdateAsyncQuestions,
    @User(['chat_token']) user: UserModel,
  ): Promise<AsyncQuestionParams> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: questionId },
      relations: [
        'creator',
        'taHelped',
        'votes',
        'comments',
        'comments.creator',
        'comments.creator.courses',
        'images',
      ],
    });
    // deep copy question since it changes
    const oldQuestion: AsyncQuestionModel = JSON.parse(
      JSON.stringify(question),
    );

    if (!question) {
      throw new NotFoundException('Question Not Found');
    }

    const courseId = question.courseId;

    // Verify if user is TA/PROF of the course
    const requester = await UserCourseModel.findOne({
      where: {
        userId: user.id,
        courseId: courseId,
      },
    });

    if (!requester || requester.role === Role.STUDENT) {
      throw new ForbiddenException(
        'You must be a TA/PROF to update this question',
      );
    }

    Object.keys(body).forEach((key) => {
      if (body[key] !== undefined && body[key] !== null) {
        question[key] = body[key];
      }
    });

    if (body.status === asyncQuestionStatus.HumanAnswered) {
      question.closedAt = new Date();
      question.taHelpedId = user.id;
      await this.asyncQuestionService.sendQuestionAnsweredEmail(question);
    } else if (
      body.status !== asyncQuestionStatus.TADeleted &&
      body.status !== asyncQuestionStatus.StudentDeleted
    ) {
      // don't send status change email if its deleted
      // (I don't like the vibes of notifying a student that their question was deleted by staff)
      // Though technically speaking this isn't even really used yet since there isn't a status that the TA would really turn it to that isn't HumanAnswered or TADeleted
      await this.asyncQuestionService.sendGenericStatusChangeEmail(
        question,
        body.status,
      );
    }

    const updatedQuestion = await question.save();

    // if saveToChatbot is true, add the question to the chatbot
    if (body.saveToChatbot) {
      await this.asyncQuestionService.upsertQAToChatbot(
        updatedQuestion,
        courseId,
        user.chat_token.token,
      );
    }

    // Mark as new unread for all students if the question is marked as visible
    if (body.visible && !oldQuestion.visible) {
      await this.asyncQuestionService.markUnreadForRoles(
        updatedQuestion,
        [Role.STUDENT],
        user.id,
      );
    }
    // When the question creator gets their question human verified, notify them
    if (
      oldQuestion.status !== asyncQuestionStatus.HumanAnswered &&
      !oldQuestion.verified &&
      (body.status === asyncQuestionStatus.HumanAnswered ||
        body.verified === true)
    ) {
      await this.asyncQuestionService.markUnreadForCreator(updatedQuestion);
    }

    if (
      body.status === asyncQuestionStatus.TADeleted ||
      body.status === asyncQuestionStatus.StudentDeleted
    ) {
      await this.redisQueueService.deleteAsyncQuestion(
        `c:${courseId}:aq`,
        updatedQuestion,
      );
      // delete all unread notifications for this question
      await UnreadAsyncQuestionModel.delete({ asyncQuestionId: questionId });
    } else {
      await this.redisQueueService.updateAsyncQuestion(
        `c:${courseId}:aq`,
        updatedQuestion,
      );
    }

    delete question.taHelped;
    delete question.votes;

    return question;
  }

  @Post('comment/:qid')
  @UseGuards(AsyncQuestionRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async postComment(
    @Param('qid', ParseIntPipe) qid: number,
    @Body() body: AsyncQuestionCommentParams,
    @User() user: UserModel,
    @Res() res: Response,
  ): Promise<Response> {
    const { commentText } = body;
    const question = await AsyncQuestionModel.findOne({
      where: { id: qid },
    });

    if (!question) {
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: ERROR_MESSAGES.questionController.notFound });
      return;
    }

    const comment = await AsyncQuestionCommentModel.create({
      commentText,
      creator: user, // do NOT change this to userId since by putting user here it will pass the full creator when sending back the comment
      question,
      createdAt: new Date(),
    }).save();

    const updatedQuestion = await AsyncQuestionModel.findOne({
      where: { id: qid },
      relations: [
        'creator',
        'taHelped',
        'votes',
        'comments',
        'comments.creator',
        'comments.creator.courses',
        'images',
      ],
    });

    await this.redisQueueService.updateAsyncQuestion(
      `c:${question.courseId}:aq`,
      updatedQuestion,
    );

    const myUserCourse = await UserCourseModel.findOne({
      where: {
        user,
        courseId: question.courseId,
      },
    });
    const myRole = myUserCourse.role;

    // don't send email if its a comment on your own post
    if (question.creatorId !== user.id) {
      await this.asyncQuestionService.sendNewCommentOnMyQuestionEmail(
        user,
        myRole,
        updatedQuestion,
        comment,
      );
    }
    // send emails out to all users that have posted a comment on this question (it also performs checks)
    await this.asyncQuestionService.sendNewCommentOnOtherQuestionEmail(
      user,
      myRole,
      question.creatorId,
      updatedQuestion,
      comment,
    );

    // new comment: if visible, mark question as unread for everyone (except the creator of the comment)
    if (updatedQuestion.visible) {
      await this.asyncQuestionService.markUnreadForAll(
        updatedQuestion,
        user.id,
      );
    } else if (myRole === Role.TA || myRole === Role.PROFESSOR) {
      // if the question is not visible, and poster is staff, mark it as unread for the creator
      await this.asyncQuestionService.markUnreadForCreator(updatedQuestion);
    } else if (myRole === Role.STUDENT) {
      // if the question is not visible, and poster is student, mark it as unread for staff
      await this.asyncQuestionService.markUnreadForRoles(
        updatedQuestion,
        [Role.TA, Role.PROFESSOR],
        user.id,
      );
    }

    // only put necessary info for the response's creator (otherwise it would send the password hash and a bunch of other unnecessary info)
    comment.creator = {
      id: user.id,
      name: user.name,
      colour: nameToRGB(Math.abs(user.id - qid).toString()),
      anonId: this.asyncQuestionService.getAnonId(user.id, qid),
      photoURL: user.photoURL,
    } as AsyncCreator as unknown as UserModel;

    res.status(HttpStatus.CREATED).send(comment);
  }

  @Patch('comment/:qid/:commentId')
  @UseGuards(AsyncQuestionRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async updateComment(
    @Param('qid', ParseIntPipe) qid: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() body: AsyncQuestionCommentParams,
    @UserId() userId: number,
    @Res() res: Response,
  ): Promise<Response> {
    const { commentText } = body;
    const question = await AsyncQuestionModel.findOne({
      where: { id: qid },
    });

    if (!question) {
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: ERROR_MESSAGES.questionController.notFound });
      return;
    }

    const comment = await AsyncQuestionCommentModel.findOne({
      where: { id: commentId, questionId: qid },
    });

    if (!comment) {
      res.status(HttpStatus.NOT_FOUND).send({
        message:
          ERROR_MESSAGES.asyncQuestionController.comments.commentNotFound,
      });
      return;
    }

    if (comment.creatorId !== userId) {
      res.status(HttpStatus.FORBIDDEN).send({
        message:
          ERROR_MESSAGES.asyncQuestionController.comments.forbiddenUpdate,
      });
      return;
    }

    comment.commentText = commentText;
    await comment.save();

    const updatedQuestion = await AsyncQuestionModel.findOne({
      where: { id: qid },
      relations: [
        'creator',
        'taHelped',
        'votes',
        'comments',
        'comments.creator',
        'comments.creator.courses',
        'images',
      ],
    });

    await this.redisQueueService.updateAsyncQuestion(
      `c:${question.courseId}:aq`,
      updatedQuestion,
    );

    res.status(HttpStatus.OK).send(comment);
  }

  @Delete('comment/:qid/:commentId')
  @UseGuards(AsyncQuestionRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async deleteComment(
    @Param('qid', ParseIntPipe) qid: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @UserId() userId: number,
    @Res() res: Response,
  ): Promise<Response> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: qid },
    });
    if (!question) {
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: ERROR_MESSAGES.questionController.notFound });
      return;
    }

    const userCourse = await UserCourseModel.findOne({
      where: {
        userId,
        courseId: question.courseId,
      },
    });
    if (!userCourse) {
      // shouldn't happen since AsyncQuestionRolesGuard should catch it
      throw new ForbiddenException('You are not in this course');
    }

    const comment = await AsyncQuestionCommentModel.findOne({
      where: { id: commentId, questionId: qid },
    });

    if (!comment) {
      res.status(HttpStatus.NOT_FOUND).send({
        message:
          ERROR_MESSAGES.asyncQuestionController.comments.commentNotFound,
      });
      return;
    }

    // staff can delete anyone's comments. students can only delete their own comments
    if (
      comment.creatorId !== userId &&
      userCourse.role !== Role.PROFESSOR &&
      userCourse.role !== Role.TA
    ) {
      res.status(HttpStatus.FORBIDDEN).send({
        message:
          ERROR_MESSAGES.asyncQuestionController.comments.forbiddenDelete,
      });
      return;
    }

    await comment.remove();

    const updatedQuestion = await AsyncQuestionModel.findOne({
      where: { id: qid },
      relations: [
        'creator',
        'taHelped',
        'votes',
        'comments',
        'comments.creator',
        'comments.creator.courses',
        'images',
      ],
    });

    await this.redisQueueService.updateAsyncQuestion(
      `c:${question.courseId}:aq`,
      updatedQuestion,
    );

    res.status(HttpStatus.OK).send({ message: 'Comment deleted' });
  }

  @Get(':courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async getAsyncQuestions(
    @Param('courseId', ParseIntPipe) courseId: number,
    @UserId() userId: number,
    @Res() res: Response,
  ): Promise<AsyncQuestion[]> {
    const userCourse = await UserCourseModel.findOne({
      where: {
        userId,
        courseId,
      },
    });
    if (!userCourse) {
      throw new ForbiddenException('You are not in this course');
    }

    const asyncQuestionKeys = await this.redisQueueService.getKey(
      `c:${courseId}:aq`,
    );
    let all: AsyncQuestionModel[] = [];

    if (!asyncQuestionKeys || Object.keys(asyncQuestionKeys).length === 0) {
      console.log('Fetching async questions from Database');
      all = await AsyncQuestionModel.find({
        where: {
          courseId,
          // don't include studentDeleted or TADeleted questions
          status: Not(
            In([
              asyncQuestionStatus.StudentDeleted,
              asyncQuestionStatus.TADeleted,
            ]),
          ),
        },
        relations: [
          'creator',
          'taHelped',
          'votes',
          'comments',
          'comments.creator',
          'comments.creator.courses',
          'images',
        ],
        order: {
          createdAt: 'DESC',
        },
        take: this.appConfig.get('max_async_questions_per_course'),
      });

      if (all)
        await this.redisQueueService.setAsyncQuestions(`c:${courseId}:aq`, all);
    } else {
      console.log('Fetching async questions from Redis');
      all = Object.values(asyncQuestionKeys).map(
        (question) => question as AsyncQuestionModel,
      );
    }

    if (!all) {
      throw new NotFoundException('No questions found');
    }

    let questions;

    const isStaff: boolean =
      userCourse.role === Role.TA || userCourse.role === Role.PROFESSOR;

    if (isStaff) {
      // Staff sees all questions except the ones deleted
      questions = all.filter(
        (question) => question.status !== asyncQuestionStatus.TADeleted,
      );
    } else {
      // Students see their own questions and questions that are visible
      questions = all.filter(
        (question) => question.creatorId === userId || question.visible,
      );
    }

    questions = questions.map((question: AsyncQuestionModel) => {
      const temp = pick(question, [
        'id',
        'courseId',
        'questionAbstract',
        'questionText',
        'aiAnswerText',
        'answerText',
        'creatorId',
        'taHelpedId',
        'createdAt',
        'closedAt',
        'status',
        'visible',
        'verified',
        'votes',
        'comments',
        'questionTypes',
        'votesSum',
        'isTaskQuestion',
        'images',
      ]);

      if (!question.comments) {
        temp.comments = [];
      } else {
        const filteredComments = question.comments.map((comment) => {
          const temp = { ...comment };
          // TODO: maybe find a more performant way of doing this (ideally in the query itself, and maybe try to include a SELECT to eliminate the pick() above. Though this may be difficult due to some of these use functions like nameToRGB or getAnonId)
          const commenterRole =
            comment.creator.courses.find(
              (course) => course.courseId === question.courseId,
            )?.role || Role.STUDENT;

          temp.creator =
            isStaff ||
            comment.creator.id === userId ||
            commenterRole !== Role.STUDENT
              ? ({
                  id: comment.creator.id,
                  anonId: this.asyncQuestionService.getAnonId(
                    comment.creator.id,
                    question.id,
                  ),
                  colour: nameToRGB(
                    Math.abs(comment.creatorId - question.id).toString(),
                  ),
                  name: comment.creator.name,
                  photoURL: comment.creator.photoURL,
                  isAuthor: comment.creator.id === question.creatorId,
                  courseRole: commenterRole,
                  // this is an AsyncCreator but I'm casting it to UserModel so typescript doesn't get mad
                } as AsyncCreator as unknown as UserModel)
              : ({
                  // don't send user name, pfp, nor userid to frontend
                  anonId: this.asyncQuestionService.getAnonId(
                    comment.creator.id,
                    question.id,
                  ),
                  colour: nameToRGB(
                    Math.abs(comment.creatorId - question.id).toString(),
                  ),
                  photoURL: null,
                  isAuthor: comment.creator.id === question.creatorId,
                  courseRole: commenterRole,
                } as AsyncCreator as unknown as UserModel);

          delete temp.creatorId;

          return temp as unknown as AsyncQuestionCommentModel;
        });
        temp.comments = filteredComments;
      }

      Object.assign(temp, {
        creator:
          isStaff || question.creator.id == userId
            ? {
                id: question.creator.id,
                anonId: this.asyncQuestionService.getAnonId(
                  question.creator.id,
                  question.id,
                ),
                colour: nameToRGB(
                  Math.abs(question.creator.id - question.id).toString(),
                ),
                name: question.creator.name,
                photoURL: question.creator.photoURL,
              }
            : {
                anonId: this.asyncQuestionService.getAnonId(
                  question.creator.id,
                  question.id,
                ),
                colour: nameToRGB(
                  Math.abs(question.creator.id - question.id).toString(),
                ),
                name: 'Anonymous',
                photoURL: null,
              },
      });

      return temp;
    });

    res.status(HttpStatus.OK).send(questions);
    return;
  }

  // Moved from userInfo context endpoint as this updates too frequently to make sense caching it with userInfo data
  @Get('unread_async_count/:courseId')
  @UseGuards(JwtAuthGuard)
  async getUnreadAsyncCount(
    @Param('courseId', ParseIntPipe) courseId: number,
    @UserId() userId: number,
  ): Promise<UnreadAsyncQuestionResponse> {
    const count = await UnreadAsyncQuestionModel.count({
      where: {
        userId,
        courseId,
        readLatest: false,
      },
    }); // typescript says that count is just a number but sometimes its not so I'm making it 0 if its falsey
    return { count: count ? count : 0 };
  }

  @Patch('unread_async_count/:courseId')
  @UseGuards(JwtAuthGuard) // technically this could use a courseRolesGuard but since can only update your own unread count it doesn't really matter
  async updateUnreadAsyncCount(
    @Param('courseId', ParseIntPipe) courseId: number,
    @UserId() userId: number,
  ): Promise<void> {
    await UnreadAsyncQuestionModel.update(
      { userId, courseId },
      { readLatest: true },
    );
    return;
  }
  @Get(':courseId/image/:imageId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async getImage(
    @Param('courseId', ParseIntPipe) courseId: number, // used for guard
    @Param('imageId', ParseIntPipe) imageId: number,
    @Query('preview') preview: boolean,
    @Res() res: Response,
  ) {
    const image = await this.asyncQuestionService.getImageById(
      imageId,
      preview,
    );

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    // Encode the filename for Content-Disposition
    const encodedFilename = encodeURIComponent(image.newFileName)
      .replace(/['()]/g, (match) => {
        return match === "'" ? '%27' : match === '(' ? '%28' : '%29';
      }) // Replace special chars with percent encoding
      .replace(/\*/g, '%2A');

    // Create filename* parameter with UTF-8 encoding per RFC 5987
    const filenameAsterisk = `UTF-8''${encodedFilename}`;

    res.set({
      'Content-Type': 'image/webp',
      // 'Cache-Control': 'public, max-age=1296000', // Cache for 4 months
      'Cache-Control': 'public, max-age=1', // Cache for 4 months
      'Content-Disposition': `inline; filename="${image.newFileName}"; filename*=${filenameAsterisk}`,
    });

    res.send(image.buffer);
  }
}
