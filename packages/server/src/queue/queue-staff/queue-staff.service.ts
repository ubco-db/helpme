import {
  OpenQuestionStatus,
  StaffMember,
  ExtraTAStatus,
  GetQueueResponse,
} from '@koh/common';
import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { QueueModel } from '../queue.entity';
import { EventModel, EventType } from 'profile/event-model.entity';
import { QueueStaffModel } from './queue-staff.entity';
import { QueueCleanService } from '../queue-clean/queue-clean.service';
type StaffHelpingInOtherQueues = {
  queueId: number;
  userId: number;
  courseId: number;
  helpedAt: Date;
}[];

/* Put this into its own service since both course.service and queue.service depend on it 
(there would be a nestjs circular dependency otherwise EDIT: okay maybe not but eh keeping it in its own
service still makes sense since I could see this receiving more functionality in the future) 
Also moved the checkin/checkout stuff here since it's related.
*/
@Injectable()
export class QueueStaffService {
  constructor(
    private dataSource: DataSource,
    private queueCleanService: QueueCleanService,
  ) {}

  /* Takes in QueueStaff[] and formats it for frontend consumption.
  Needs the following for getting StaffHelpingInOtherQueues (omit `courses: true` if you don't need it):
      relations: {
        queueStaff: {
          user: {
            courses: true,
          },
        },
      },
  */
  async getFormattedStaffList(queue: QueueModel): Promise<StaffMember[]> {
    let StaffHelpingInOtherQueues = [];
    if (queue.queueStaff[0].user.courses) {
      // if the first user has any courses, it's assumed courses isn't undefined and thus included in the query
      StaffHelpingInOtherQueues = await this.getStaffHelpingInOtherQueues(
        queue.queueStaff[0].queueId,
      );
    }
    return queue.queueStaff.map((queueStaff) => {
      const staffHelpingInOtherQueue = StaffHelpingInOtherQueues.find(
        (staff) => staff.userId === queueStaff.userId,
      );
      // precedence: if user marked themselves away, show that, else show helping-in-other-* status
      return {
        id: queueStaff.userId,
        name: queueStaff.user.name,
        photoURL: queueStaff.user.photoURL,
        TANotes:
          queueStaff.user.courses.find((ucm) => ucm.courseId === queue.courseId)
            ?.TANotes ?? '',
        extraStatus:
          queueStaff.extraTAStatus === ExtraTAStatus.AWAY
            ? ExtraTAStatus.AWAY
            : !staffHelpingInOtherQueue
              ? undefined
              : staffHelpingInOtherQueue.courseId !== queue.courseId
                ? ExtraTAStatus.HELPING_IN_ANOTHER_COURSE
                : staffHelpingInOtherQueue.queueId !== queue.id
                  ? ExtraTAStatus.HELPING_IN_ANOTHER_QUEUE
                  : undefined,
        helpingStudentInAnotherQueueSince: staffHelpingInOtherQueue?.helpedAt,
      };
    });
  }

  /* Some pieces of backend have their own QueueModel objects and just want to add on the proper staffList before sending to frontend
      Needs the following for getting StaffHelpingInOtherQueues (omit `courses: true` if you don't need it):
      relations: {
        queueStaff: {
          user: {
            courses: true,
          },
        },
      },
    */
  async formatStaffListPropertyForFrontend(
    rawQueue: QueueModel,
  ): Promise<GetQueueResponse> {
    const staffList = await this.getFormattedStaffList(rawQueue);
    const { queueStaff, ...queue } = rawQueue; // remove queueStaff property from QueueModel (rename to staffList for frontend)
    return {
      ...queue,
      staffList,
    };
  }

  /* Finds all staff members who are helping in other queues that ARE NOT the given queue.
     It also returns the question's helpedAt so you can display how long they have been helped for.
  */
  async getStaffHelpingInOtherQueues(
    queueId: number,
  ): Promise<StaffHelpingInOtherQueues> {
    // yes, this is joining the staff list table with itself. We start with the queueId of this queue and want to find which staff that are in this queue that are also checked into other queues.
    const query = `
    SELECT q.id AS "queueId", qstaff2."userId" AS "userId", q."courseId", question."helpedAt"
    FROM queue_staff_model AS qstaff1
    RIGHT JOIN queue_staff_model AS qstaff2 ON qstaff1."userId" = qstaff2."userId" AND qstaff2."queueId" != 19 
    LEFT JOIN queue_model AS q ON qstaff2."queueId" = q.id
    RIGHT JOIN question_model AS question ON question."queueId" = q.id AND question."taHelpedId" = qstaff2."userId" AND question.status = $1
    WHERE qstaff1."queueId" = $2
    `;
    const result = (await this.dataSource.query(query, [
      OpenQuestionStatus.Helping,
      queueId,
    ])) as StaffHelpingInOtherQueues;
    return result ? result : [];
  }

  async setTAExtraStatusForQueue(
    queueId: number,
    courseId: number,
    userId: number,
    status: ExtraTAStatus | null,
  ): Promise<void> {
    const allowedStatuses: Array<ExtraTAStatus | null> = [
      ExtraTAStatus.AWAY,
      null,
    ];
    if (!allowedStatuses.includes(status ?? null)) {
      throw new BadRequestException('Invalid status given');
    }

    const joinRow = await QueueStaffModel.findOne({
      where: { queueId, userId },
    });
    if (!joinRow) {
      throw new BadRequestException('Unable to set status');
    }

    const prev = joinRow.extraTAStatus;
    joinRow.extraTAStatus = status ?? null;
    await joinRow.save();

    if (
      prev !== ExtraTAStatus.AWAY &&
      joinRow.extraTAStatus === ExtraTAStatus.AWAY
    ) {
      await EventModel.create({
        time: new Date(),
        eventType: EventType.TA_MARKED_SELF_AWAY,
        userId,
        courseId,
        queueId,
      }).save();
    } else if (
      prev === ExtraTAStatus.AWAY &&
      (joinRow.extraTAStatus === null || joinRow.extraTAStatus === undefined)
    ) {
      await EventModel.create({
        time: new Date(),
        eventType: EventType.TA_MARKED_SELF_BACK,
        userId,
        courseId,
        queueId,
      }).save();
    }
  }

  async checkUserIn(
    userId: number,
    queueId: number,
    courseId: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const existingQueueStaff = await manager.findOne(QueueStaffModel, {
        where: { queueId, userId },
      });
      if (existingQueueStaff) {
        return;
      }
      await manager
        .create(QueueStaffModel, {
          queueId,
          userId,
        })
        .save();

      await manager
        .create(EventModel, {
          time: new Date(),
          eventType: EventType.TA_CHECKED_IN,
          userId,
          courseId,
          queueId,
        })
        .save();
    });
  }

  async checkUserOut(
    userId: number,
    queueId: number,
    courseId: number,
    manager: EntityManager,
  ): Promise<void> {
    const existingQueueStaff = await manager.findOne(QueueStaffModel, {
      where: { queueId, userId },
    });
    // Do nothing if user not already in stafflist
    if (!existingQueueStaff) {
      return;
    }
    await manager.delete(QueueStaffModel, {
      queueId,
      userId,
    });

    await manager
      .create(EventModel, {
        time: new Date(),
        eventType: EventType.TA_CHECKED_OUT,
        userId,
        courseId,
        queueId,
      })
      .save();

    // if this was the last user to check out of the queue, disallow questions (idk what the purpose of that is exactly)
    // and prompt students to leave queue
    const queueStaffCount = await manager.count(QueueStaffModel, {
      where: { queueId },
    });
    if (queueStaffCount === 0) {
      await manager.update(QueueModel, queueId, {
        allowQuestions: false,
      });
      // (this needs to be after deleting the queue staff since this service also checks if the stafflist is empty)
      await this.queueCleanService.promptStudentsToLeaveQueue(queueId, manager);
    }
  }

  async checkUserOutAll(
    userId: number,
    courseId: number,
    manager: EntityManager,
  ): Promise<void> {
    const existingQueueStaff = await manager.find(QueueStaffModel, {
      where: { userId },
    });
    if (!existingQueueStaff) {
      // not checked into any queues
      return;
    }

    for (const queueStaff of existingQueueStaff) {
      await this.checkUserOut(
        queueStaff.userId,
        queueStaff.queueId,
        courseId,
        manager,
      );
    }
  }
}
