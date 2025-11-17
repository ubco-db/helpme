import {
  BatchCourseCloneAttributes,
  BatchCourseCloneResponse,
  CourseCloneAttributes,
  EditCourseInfoParams,
  ERROR_MESSAGES,
  GetCourseUserInfoResponse,
  MailServiceType,
  OrganizationRole,
  QueueConfig,
  QueueTypes,
  Role,
  TACheckinPair,
  TACheckinTimesResponse,
  UserCourse,
  UserPartial,
} from '@koh/common';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { parseInt, partition } from 'lodash';
import { EventModel, EventType } from 'profile/event-model.entity';
import { QuestionModel } from 'question/question.entity';
import { Between, DataSource, EntityManager, In, IsNull } from 'typeorm';
import { UserCourseModel } from '../profile/user-course.entity';
import { CourseModel } from './course.entity';
import { UserModel } from 'profile/user.entity';
import { QueueInviteModel } from 'queue/queue-invite.entity';
import { UnreadAsyncQuestionModel } from 'asyncQuestion/unread-async-question.entity';
import { CourseSettingsModel } from './course_settings.entity';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { OrganizationCourseModel } from 'organization/organization-course.entity';
import { SemesterModel } from 'semester/semester.entity';
import { MailService } from 'mail/mail.service';
import { ChatbotApiService } from 'chatbot/chatbot-api.service';
import { QuestionTypeModel } from 'questionType/question-type.entity';
import { QueueModel } from 'queue/queue.entity';
import { SuperCourseModel } from './super-course.entity';
import { ChatbotDocPdfModel } from 'chatbot/chatbot-doc-pdf.entity';
import { URLSearchParams } from 'node:url';

@Injectable()
export class CourseService {
  constructor(
    private readonly mailService: MailService,
    private readonly chatbotApiService: ChatbotApiService,
    private readonly dataSource: DataSource,
  ) {}

  async getTACheckInCheckOutTimes(
    courseId: number,
    startDate: string,
    endDate: string,
  ): Promise<TACheckinTimesResponse> {
    const startDateAsDate = new Date(startDate);
    const endDateAsDate = new Date(endDate);
    if (startDateAsDate.getUTCDate() === endDateAsDate.getUTCDate()) {
      endDateAsDate.setUTCDate(endDateAsDate.getUTCDate() + 1);
    }

    const taEvents = await EventModel.find({
      where: {
        eventType: In([
          EventType.TA_CHECKED_IN,
          EventType.TA_CHECKED_OUT,
          EventType.TA_CHECKED_OUT_FORCED,
          EventType.TA_CHECKED_OUT_EVENT_END,
        ]),
        time: Between(startDateAsDate, endDateAsDate),
        courseId,
      },
      relations: ['user'],
    });

    const [checkinEvents, otherEvents] = partition(
      taEvents,
      (e) => e.eventType === EventType.TA_CHECKED_IN,
    );

    const taCheckinTimes: TACheckinPair[] = [];

    for (const checkinEvent of checkinEvents) {
      let closestEvent: EventModel = null;
      let mostRecentTime = new Date();
      const originalDate = mostRecentTime;

      for (const checkoutEvent of otherEvents) {
        if (
          checkoutEvent.userId === checkinEvent.userId &&
          checkoutEvent.time > checkinEvent.time &&
          checkoutEvent.time.getTime() - checkinEvent.time.getTime() <
            mostRecentTime.getTime() - checkinEvent.time.getTime()
        ) {
          closestEvent = checkoutEvent;
          mostRecentTime = checkoutEvent.time;
        }
      }

      const numHelped = await QuestionModel.count({
        where: {
          taHelpedId: checkinEvent.userId,
          helpedAt: Between(
            checkinEvent.time,
            closestEvent?.time || new Date(),
          ),
        },
      });

      taCheckinTimes.push({
        name: checkinEvent.user.name,
        checkinTime: checkinEvent.time,
        checkoutTime: closestEvent?.time,
        inProgress: mostRecentTime === originalDate,
        forced: closestEvent?.eventType === EventType.TA_CHECKED_OUT_FORCED,
        numHelped,
      });
    }

    return { taCheckinTimes };
  }

  async removeUserFromCourse(userCourse: UserCourseModel): Promise<void> {
    if (!userCourse) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseNotFound,
        HttpStatus.NOT_FOUND,
      );
    }
    try {
      await UserCourseModel.remove(userCourse);
      await UnreadAsyncQuestionModel.delete({
        userId: userCourse.userId,
        courseId: userCourse.courseId,
      });
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.courseController.removeCourse,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async editCourse(
    courseId: number,
    coursePatch: EditCourseInfoParams,
  ): Promise<void> {
    const course = await CourseModel.findOne({
      where: {
        id: courseId,
      },
    });
    if (course === null || course === undefined) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    // Destructure coursePatch to separate courseInviteCode from other fields
    const { courseInviteCode, ...otherFields } = coursePatch;
    // Allow courseInviteCode to be null or empty but no other fields
    if (Object.values(otherFields).some((x) => x === null || x === '')) {
      throw new BadRequestException(
        ERROR_MESSAGES.courseController.updateCourse,
      );
    }

    if (coursePatch.name) {
      course.name = coursePatch.name;
    }

    if (coursePatch.coordinator_email) {
      course.coordinator_email = coursePatch.coordinator_email;
    }

    if (coursePatch.icalURL) {
      course.icalURL = coursePatch.icalURL;
    }

    if (coursePatch.zoomLink) {
      course.zoomLink = coursePatch.zoomLink;
    }
    if (coursePatch.questionTimer) {
      course.questionTimer = coursePatch.questionTimer;
    }

    if (coursePatch.timezone) {
      course.timezone = coursePatch.timezone;
    }

    if (coursePatch.enabled) {
      course.enabled = coursePatch.enabled;
    }

    if (coursePatch.courseInviteCode !== undefined) {
      course.courseInviteCode = coursePatch.courseInviteCode;
    }

    if (coursePatch.asyncQuestionDisplayTypes) {
      course.asyncQuestionDisplayTypes = coursePatch.asyncQuestionDisplayTypes;
    }

    try {
      await course.save();
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.courseController.updateCourse,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUserInfo(
    courseId: number,
    page: number,
    pageSize: number,
    search?: string,
    roles?: Role[],
  ): Promise<GetCourseUserInfoResponse> {
    // these are the params the query will use
    const params: any[] = [courseId, pageSize, (page - 1) * pageSize];

    // check if searching for specific role and ensure it is a valid role
    let roleCondition = '';
    if (roles && roles.length > 0) {
      if (roles.some((role) => !Object.values(Role).includes(role))) {
        throw new BadRequestException(
          ERROR_MESSAGES.courseController.roleInvalid,
        );
      }
      roleCondition = `AND user_course_model.role::text = ANY($4::text[])`;
      params.push(roles);
    }

    // check if searching for specific name
    let searchCondition = '';
    if (search) {
      const searchString = search.toUpperCase();
      searchCondition = `
        AND UPPER(user_model.name)
          LIKE '%' || ${roleCondition ? '$5' : '$4'} || '%'
      `;
      params.push(searchString);
    }

    const query = `
      SELECT user_model.id, user_model.name, user_model."photoURL", user_model.email, user_model.sid, user_course_model."TANotes", organization_user_model."role" as "organizationRole", COUNT(*) OVER () AS total
      FROM user_course_model
      INNER JOIN user_model ON user_model.id = user_course_model."userId"
      LEFT JOIN organization_user_model ON user_course_model."userId" = organization_user_model."userId"
      WHERE user_course_model."courseId" = $1
        ${roleCondition}
        ${searchCondition}
      ORDER BY user_model.name
      LIMIT $2
      OFFSET $3
    `;

    // make the query
    const rawUsers = (await UserCourseModel.query(
      query,
      params,
    )) as UserPartial &
      {
        total: number;
      }[];

    const total = rawUsers.length > 0 ? Number(rawUsers[0].total) : 0;

    // strip out the total from the rawUsers (not a huge performance hit since n is always going to be <= 50, and adding another DB query for count would be much more expensive)
    const users: UserPartial[] = rawUsers.map(
      ({ total, ...rest }) => ({ ...rest }) as UserPartial,
    );

    return { users, total };
  }

  async addStudentToCourse(
    course: CourseModel,
    user: UserModel,
  ): Promise<boolean> {
    try {
      const userInCourse = await UserCourseModel.findOne({
        where: { userId: user.id, courseId: course.id },
      });

      if (userInCourse) {
        return false;
      }

      const userCourse = await UserCourseModel.create({
        userId: user.id,
        courseId: course.id,
        role: Role.STUDENT,
      }).save();

      const updatedUserCourse = user.courses;
      updatedUserCourse.push(userCourse);
      user.courses = updatedUserCourse;
      await user.save();

      return true;
    } catch {
      return false;
    }
  }

  /**
   * There isn't really a good reason why this method is in course.service.ts other than it is close to addStudentToCourse. It would probably be better fitted in its own queue-invite.service.ts file but that is more effort than its worth
    This method return a redirect URL based on things.
    It will also enroll the user in the course if the queueInvite has willInviteToCourse set to true
  */
  async getQueueInviteRedirectURLandInviteToCourse(
    queueInviteCookie: string,
    userId: number,
  ): Promise<{ url: string; queryParams: URLSearchParams }> {
    const decodedCookie = decodeURIComponent(queueInviteCookie);
    const splitCookie = decodedCookie.split(',');
    const courseId = splitCookie[0];
    const queueId = splitCookie[1];
    const orgId = splitCookie[2];
    const courseInviteCode = Buffer.from(splitCookie[3], 'base64').toString(
      'utf-8',
    );

    // check if the queueInvite exists and if it will invite to course
    const queueInvite = await QueueInviteModel.findOne({
      where: {
        queueId: parseInt(queueId),
      },
    });
    // get the user to see if they are in the course
    const user = await UserModel.findOne({
      where: { id: userId },
      relations: ['courses'],
    });

    if (!user) {
      return {
        url: '/login',
        queryParams: new URLSearchParams({
          error: 'notSuccessfullyLoggedIn',
        }),
      };
    }

    const isUserInCourse = user.courses.some(
      (course) => course.courseId === Number(courseId),
    );

    let url: string = '/courses';
    const queryParams = new URLSearchParams();

    const getUrlAndParams = async (): Promise<void> => {
      if (isUserInCourse) {
        // if they're already in the course, just redirect them to the queue
        if (courseId && queueId) {
          url = `/course/${courseId}/queue/${queueId}`;
        } else if (courseId) {
          url = `/course/${courseId}`;
        }
        return;
      }

      if (!queueInvite) {
        // if the queueInvite doesn't exist
        queryParams.set('err', 'inviteNotFound');
        return;
      }

      if (queueInvite.willInviteToCourse && courseInviteCode) {
        // get course
        const course = await CourseModel.findOne({
          where: {
            id: parseInt(courseId),
          },
        });

        if (!course) {
          queryParams.set('err', 'courseNotFound');
          return;
        }

        if (course.courseInviteCode !== courseInviteCode) {
          queryParams.set('err', 'badCourseInviteCode');
          return;
        }

        await this.addStudentToCourse(course, user).catch((err) => {
          throw new BadRequestException(err.message);
        });

        if (courseId && queueId) {
          url = `/course/${courseId}/queue/${queueId}`;
        } else if (courseId) {
          url = `/course/${courseId}`;
        }
        return;
      }

      queryParams.set('err', 'notInCourse');
    };

    await getUrlAndParams();

    return {
      url,
      queryParams,
    };
  }

  async cloneCourse(
    courseId: number,
    userId: number,
    cloneData: CourseCloneAttributes,
    chatToken: string,
  ): Promise<UserCourse | null> {
    if (!cloneData.professorIds || cloneData.professorIds.length === 0) {
      throw new BadRequestException(
        'At least one professor must be provided for your course clone.',
      );
    }

    return await this.dataSource.transaction(async (manager) => {
      const originalCourse = await manager.findOne(CourseModel, {
        where: { id: courseId },
        relations: ['courseSettings', 'semester'],
      });
      if (!originalCourse) {
        throw new NotFoundException(`Course with id ${courseId} not found`);
      }

      // to generalize operation for batch cloning as well (a single value of -1 means clone the professors as well)
      const originalProfessors = await manager.find(UserCourseModel, {
        where: {
          courseId,
          role: Role.PROFESSOR,
        },
      });

      if (
        cloneData.professorIds.length === 1 &&
        cloneData.professorIds[0] === -1
      ) {
        cloneData.professorIds = originalProfessors.map(
          (userCourse) => userCourse.userId,
        );
      }

      // If the user is not an Organization Administrator, they can only set themselves as the cloned course's professor
      const organizationUser = await manager.findOne(OrganizationUserModel, {
        where: { userId: userId },
      });
      if (organizationUser.role !== OrganizationRole.ADMIN) {
        cloneData.professorIds = [userId];
      }

      const professorIds = Array.isArray(cloneData.professorIds)
        ? cloneData.professorIds
        : [cloneData.professorIds];
      const professors = await manager.findBy(UserModel, {
        id: In(professorIds),
      });
      if (professors.length !== professorIds.length) {
        throw new NotFoundException(`One or more professors not found`);
      }

      const clonedCourse = new CourseModel();
      clonedCourse.enabled = true;
      clonedCourse.name = originalCourse.name;
      clonedCourse.timezone = originalCourse.timezone;

      if (cloneData.toClone?.coordinator_email) {
        clonedCourse.coordinator_email = originalCourse.coordinator_email;
      }
      if (cloneData.toClone?.zoomLink) {
        clonedCourse.zoomLink = originalCourse.zoomLink;
      }
      if (cloneData.toClone?.courseInviteCode) {
        clonedCourse.courseInviteCode = originalCourse.courseInviteCode;
      }

      clonedCourse.sectionGroupName =
        cloneData.newSection && cloneData.newSection.trim() !== ''
          ? cloneData.newSection
          : originalCourse.sectionGroupName;

      if (cloneData.newSemesterId) {
        if (cloneData.newSemesterId !== -1) {
          const semester = await manager.findOne(SemesterModel, {
            where: { id: cloneData.newSemesterId },
          });
          if (semester) {
            clonedCourse.semester = semester;
          }
        }
      } else {
        clonedCourse.semester = originalCourse.semester;
      }

      await manager.save(clonedCourse);

      if (originalCourse.courseSettings) {
        const origSettings = originalCourse.courseSettings;
        const clonedSettings = new CourseSettingsModel();
        clonedSettings.courseId = clonedCourse.id;
        if (cloneData.toClone.courseFeatureConfig) {
          clonedSettings.chatBotEnabled = origSettings.chatBotEnabled;
          clonedSettings.asyncQueueEnabled = origSettings.asyncQueueEnabled;
          clonedSettings.queueEnabled = origSettings.queueEnabled;
          clonedSettings.scheduleOnFrontPage = origSettings.scheduleOnFrontPage;
          clonedSettings.asyncCentreAIAnswers =
            origSettings.asyncCentreAIAnswers;
        }
        await manager.save(clonedSettings);
      } else {
        const clonedSettings = new CourseSettingsModel();
        clonedSettings.courseId = clonedCourse.id;
        await manager.save(clonedSettings);
      }

      if (professors.length > 0) {
        for (const professor of professors) {
          const profUserCourse = new UserCourseModel();
          profUserCourse.user = professor;
          profUserCourse.course = clonedCourse;
          profUserCourse.role = Role.PROFESSOR;
          await manager.save(profUserCourse);
        }
      } else {
        console.error(
          `Somehow no professors were provided for course clone of course ${originalCourse.id}. New course Id ${clonedCourse.id}. Assigning the cloner to the course`,
        );
        const profUserCourse = new UserCourseModel();
        profUserCourse.userId = userId;
        profUserCourse.courseId = clonedCourse.id;
        profUserCourse.role = Role.PROFESSOR;
        await manager.save(profUserCourse);
      }

      const organizationCourse = new OrganizationCourseModel();

      organizationCourse.courseId = clonedCourse.id;
      organizationCourse.organizationId = organizationUser.organizationId;
      await manager.save(organizationCourse);

      // -------------- For Queues --------------
      if (cloneData.toClone.queues) {
        const originalQueues = await manager.find(QueueModel, {
          where: { courseId, isDisabled: false },
          relations: {
            queueInvite: true,
          },
        });
        for (const queue of originalQueues) {
          // all questiontypes will be based off of whatever the queue config is
          const newQueue = await this.createQueue(
            clonedCourse.id,
            queue.room,
            queue.type,
            queue.notes,
            queue.isProfessorQueue,
            queue.config,
            manager,
          );
          if (cloneData.toClone.queueInvites && queue.queueInvite) {
            // create a new queue invite based off the old one but with the new queue id
            await manager.getRepository(QueueInviteModel).insert({
              ...queue.queueInvite,
              queueId: newQueue.id,
            });
          }
        }
      }

      // -------------- For Async Centre Question Types --------------
      if (cloneData.toClone.asyncCentreQuestionTypes) {
        const originalQuestionTypes = await manager.find(QuestionTypeModel, {
          where: {
            cid: courseId,
            queueId: IsNull(), // null queueId means it's a question type for async centre
          },
        });
        for (const questionType of originalQuestionTypes) {
          await manager.getRepository(QuestionTypeModel).insert({
            cid: clonedCourse.id,
            name: questionType.name,
            color: questionType.color,
            queueId: null,
          });
        }
      }

      // -------------- For Super Courses --------------

      // find associated super course, if one does not exist, create one and add the original and cloned course to it
      if (cloneData.associateWithOriginalCourse) {
        const superCourse = await SuperCourseModel.findOne({
          where: {
            courses: {
              id: In([courseId]),
            },
          },
        });

        if (!superCourse) {
          let newSuperCourse = new SuperCourseModel();
          newSuperCourse.name = originalCourse.name;
          newSuperCourse.organizationId = organizationUser.organizationId;
          newSuperCourse = await manager.save(newSuperCourse);
          clonedCourse.superCourseId = newSuperCourse.id;
          await manager.save(clonedCourse);
          originalCourse.superCourseId = newSuperCourse.id;
          await manager.save(originalCourse);
        } else {
          // if a super course already exists, add the cloned course to it
          clonedCourse.superCourseId = superCourse.id;
          await manager.save(clonedCourse); // i have no idea if this 2nd save is necessary but i have it here for fun
        }
      }

      // -------------- For Chatbot Settings and Documents --------------
      const docIdMap = {};
      // clone over all chatbot document pdfs in helpme db
      if (cloneData.toClone.chatbot?.documents) {
        await manager.query(
          // this is pretty slick
          `INSERT INTO chatbot_doc_pdf_model 
           ("docName", "courseId", "docData", "docSizeBytes", "docIdChatbotDB") 
           SELECT "docName", $1, "docData", "docSizeBytes", "docIdChatbotDB" 
           FROM chatbot_doc_pdf_model 
           WHERE "courseId" = $2`,
          [clonedCourse.id, courseId],
        );
        // get all the idHelpMeDB and docIdChatbotDB values from the cloned course
        const clonedCourseDocPdfs = await manager.find(ChatbotDocPdfModel, {
          select: {
            // only need these 2 fields. Don't want the whole documents
            idHelpMeDB: true,
            docIdChatbotDB: true, // these are the old ids, we need to update them once the new document aggregates are cloned in the chatbot repo
          },
          where: { courseId: clonedCourse.id },
        });
        for (const doc of clonedCourseDocPdfs) {
          // map each old docIdChatbotDB to the new idHelpMeDB
          docIdMap[doc.docIdChatbotDB] = doc.idHelpMeDB.toString();
        }
      }

      // IMPORTANT: do chatbot api stuff last since if something after the api calls fails i can't
      // go back and tell the chatbot service to revert what it already did.
      // Also note that we do not need to do anything special to create a course on the chatbot repo side
      // since it will automatically create a chatbot service when you call an endpoint with a courseId that does not exist
      if (cloneData.toClone.chatbot?.settings) {
        const oldChatbotSettings = await this.chatbotApiService
          .getChatbotSettings(courseId, chatToken)
          .catch((err) => {
            console.error(
              `Failed to get current course chatbot data in chatbot service:`,
              err,
            );
            throw new InternalServerErrorException(
              `Failed to fetch chatbot settings for current course from chatbot service: ${err.message}`,
            );
          });

        await this.chatbotApiService
          .updateChatbotSettings(
            oldChatbotSettings.metadata,
            clonedCourse.id,
            chatToken,
          )
          .catch((err) => {
            console.error(
              `Failed to set cloned chatbot data in chatbot service:`,
              err,
            );
            throw new InternalServerErrorException(
              `Failed to set cloned chatbot data from chatbot service: ${err.message}`,
            );
          });
      }
      if (
        cloneData.toClone.chatbot?.documents ||
        cloneData.toClone.chatbot?.insertedQuestions ||
        cloneData.toClone.chatbot?.insertedLMSData
      ) {
        const result = await this.chatbotApiService
          .cloneCourseDocuments(
            courseId,
            chatToken,
            clonedCourse.id,
            cloneData.toClone.chatbot?.documents === true,
            cloneData.toClone.chatbot?.insertedQuestions === true,
            cloneData.toClone.chatbot?.insertedLMSData === true,
            cloneData.toClone.chatbot?.manuallyCreatedChunks === true,
            docIdMap,
          )
          .catch((err) => {
            console.error(
              `Failed to clone chatbot documents from original course in chatbot service:`,
              err,
            );
            throw new InternalServerErrorException(
              `Failed to clone chatbot documents from original course in chatbot service: ${err.message}`,
            );
          });

        // so much work just to sync the urls in the chatbot repo and sync the docIdChatbotDB here
        if (cloneData.toClone.chatbot?.documents) {
          if (
            result.newAggregateHelpmePDFIdMap &&
            Object.keys(result.newAggregateHelpmePDFIdMap).length > 0
          ) {
            for (const [newHelpmeDocId, newAggregateDocId] of Object.entries(
              result.newAggregateHelpmePDFIdMap,
            )) {
              await manager.update(
                ChatbotDocPdfModel,
                { idHelpMeDB: newHelpmeDocId },
                { docIdChatbotDB: newAggregateDocId },
              );
            }
          }

          // some extra error checks. No sense in showing an error since things cannot be reverted from this point onwards
          // without somehow making the transaction on the chatbot repo side rollback.
          if (
            Object.keys(docIdMap).length > 0 &&
            result.newAggregateHelpmePDFIdMap &&
            Object.keys(result.newAggregateHelpmePDFIdMap).length > 0 &&
            Object.keys(result.newAggregateHelpmePDFIdMap).length <
              Object.keys(docIdMap).length
          ) {
            console.error(`Error during end of course clone for clone course Id ${clonedCourse.id} (original course Id: ${courseId}). 
              Partial document mapping detected. Despite the helpme repo having ${Object.keys(docIdMap).length} document pdfs to clone, 
              the chatbot repo only returned ${Object.keys(result.newAggregateHelpmePDFIdMap).length} new document ids.
              This could mean some documents were not cloned properly, or perhaps a desync where the helpme repo has more chatbot documents
              than the equivalent on the chatbot repo.
              ${Object.keys(docIdMap).length - Object.keys(result.newAggregateHelpmePDFIdMap).length} documents were not cloned.
              HelpMe docIdMap: ${JSON.stringify(docIdMap)}
              Chatbot repo newAggregateHelpmePDFIdMap: ${JSON.stringify(result.newAggregateHelpmePDFIdMap)}
              `);
          } else if (
            Object.keys(docIdMap).length > 0 &&
            !result.newAggregateHelpmePDFIdMap
          ) {
            console.error(`Error during end of course clone for clone course Id ${clonedCourse.id} (original course Id: ${courseId}). 
              No new document ids were returned from the chatbot repo.
              Meaning either something may have gone horribly wrong or there is a desync between the helpme repo and the chatbot repo (probably the former).
              HelpMe docIdMap: ${JSON.stringify(docIdMap)}
              `);
          } else if (
            Object.keys(docIdMap).length === 0 &&
            result.newAggregateHelpmePDFIdMap &&
            Object.keys(result.newAggregateHelpmePDFIdMap).length > 0
          ) {
            console.error(`Error during end of course clone for clone course Id ${clonedCourse.id} (original course Id: ${courseId}). 
              Somehow the helpme repo has no document pdfs to clone, but the chatbot repo returned ${Object.keys(result.newAggregateHelpmePDFIdMap).length} new document ids.
              I have no idea how this could happen.
              HelpMe docIdMap: ${JSON.stringify(docIdMap)}
              Chatbot repo newAggregateHelpmePDFIdMap: ${JSON.stringify(result.newAggregateHelpmePDFIdMap)}
              `);
          } else if (
            Object.keys(docIdMap).length === 0 &&
            (!result.newAggregateHelpmePDFIdMap ||
              Object.keys(result.newAggregateHelpmePDFIdMap).length === 0)
          ) {
            console.log(
              `No document pdfs were cloned for clone course Id ${clonedCourse.id} (original course Id: ${courseId}). `,
            );
          }
        }
      }

      if (professorIds.includes(userId)) {
        return {
          course: {
            id: clonedCourse.id,
            name: clonedCourse.name,
            semesterId: clonedCourse.semesterId,
            enabled: clonedCourse.enabled,
            sectionGroupName: clonedCourse.sectionGroupName,
          },
          role: Role.PROFESSOR,
          favourited: true,
        };
      } else {
        return null;
      }
    });
  }

  async performBatchClone(
    user: UserModel,
    body: BatchCourseCloneAttributes,
  ): Promise<void> {
    const progressLog: BatchCourseCloneResponse[] = [];
    for (const key of Object.keys(body)) {
      const courseId = parseInt(key);
      const cloneData = body[key];
      let courseName = `Course ID ${courseId}`; // Default name

      try {
        const course = await CourseModel.findOne({ where: { id: courseId } });
        if (!course) {
          throw new Error(`Course with id ${courseId} not found`);
        }
        courseName = course.name.trim();

        if (!cloneData) {
          throw new Error(`Missing clone parameters`);
        }

        await this.cloneCourse(
          courseId,
          user.id,
          cloneData,
          user.chat_token.token,
        );

        progressLog.push({
          success: true,
          message: `Successfully cloned course "${courseName}" with id ${courseId}`,
        });
      } catch (error) {
        progressLog.push({
          success: false,
          message: `Error cloning course "${courseName}" with id ${courseId}: ${error.message || error}`,
        });
      }
    }

    // Send summary email
    const bodyRender = `
      <br>
      <h2>Course Clone Summary</h2>
      <br>
      <p>Here is the summary of the course cloning process:</p>
      <ul>
        ${progressLog
          .map(
            (log) =>
              `<li style="color: ${
                log.success ? 'green' : 'red'
              }">${log.message}</li>`,
          )
          .join('')}
      </ul>
      <br>
      Note: Do NOT reply to this email.
    `;

    this.mailService.sendEmail({
      receiverOrReceivers: user.email,
      type: MailServiceType.COURSE_CLONE_SUMMARY,
      subject: 'HelpMe - Course Clone Summary',
      content: bodyRender,
    });
  }

  async createQueue(
    courseId: number,
    room: string,
    type: QueueTypes,
    notes: string,
    isProfessorQueue: boolean,
    config: QueueConfig,
    transactionalEntityManager?: EntityManager,
  ): Promise<QueueModel> {
    let createdQueue = null;
    // if passing in a transaction manager, use it. Otherwise, create one and use that
    if (transactionalEntityManager) {
      createdQueue = await transactionalEntityManager
        .getRepository(QueueModel)
        .save({
          room,
          courseId,
          type,
          staffList: [],
          questions: [],
          allowQuestions: true,
          notes,
          isProfessorQueue,
          config,
        });

      // now for each tag defined in the config, create a QuestionType
      const questionTypes = config.tags ?? {};
      for (const [tagKey, tagValue] of Object.entries(questionTypes)) {
        await transactionalEntityManager
          .getRepository(QuestionTypeModel)
          .insert({
            cid: courseId,
            name: tagValue.display_name,
            color: tagValue.color_hex,
            queueId: createdQueue.id,
          });
      }
    } else {
      await this.dataSource.transaction(async (transactionalEntityManager) => {
        createdQueue = await transactionalEntityManager
          .getRepository(QueueModel)
          .save({
            room,
            courseId,
            type,
            staffList: [],
            questions: [],
            allowQuestions: true,
            notes,
            isProfessorQueue,
            config,
          });

        // now for each tag defined in the config, create a QuestionType
        const questionTypes = config.tags ?? {};
        for (const [tagKey, tagValue] of Object.entries(questionTypes)) {
          await transactionalEntityManager
            .getRepository(QuestionTypeModel)
            .insert({
              cid: courseId,
              name: tagValue.display_name,
              color: tagValue.color_hex,
              queueId: createdQueue.id,
            });
        }
      });
    }

    return createdQueue;
  }
}
