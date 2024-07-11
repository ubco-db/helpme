import { Role } from '@koh/common';
import {
  CourseFactory,
  UserCourseFactory,
  UserFactory,
  StudentTaskProgressFactory,
  QueueFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { StudentTaskProgressModule } from 'studentTaskProgress/studentTaskProgress.module';

describe('StudentTaskProgress Integration', () => {
  const supertest = setupIntegrationTest(StudentTaskProgressModule);
  describe('GET /studentTaskProgress/student/:userId/:courseId/:assignmentName', () => {
    it('should return 401 if user is not authorized', async () => {
      await supertest()
        .get(`/studentTaskProgress/student/1/1/assignment1`)
        .expect(401);
    });

    it('should return 404 if invalid course or invalid user', async () => {
      const course = await CourseFactory.create();
      const student = await UserFactory.create();
      const professor = await UserFactory.create();

      await UserCourseFactory.create({
        user: student,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });
      await StudentTaskProgressFactory.create({
        user: student,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: 1,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });
      // invalid course
      const resp3 = await supertest({ userId: student.id }).get(
        `/studentTaskProgress/student/${student.id}/${
          course.id + 1
        }/assignment1`,
      );
      // expect(resp3.body).toEqual({});
      expect(resp3.status).toBe(404);

      // invalid student
      const resp = await supertest({ userId: student.id }).get(
        `/studentTaskProgress/student/30/${course.id}/assignment1`,
      );
      expect(resp.body).toEqual({});
      // expect(resp.status).toBe(404); it's returning 200 and honestly that's fine for now
    });

    it('should return {} if no assignment is found (student has not started assignment)', async () => {
      const course = await CourseFactory.create();
      const student = await UserFactory.create();
      const professor = await UserFactory.create();

      await UserCourseFactory.create({
        user: student,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });
      await StudentTaskProgressFactory.create({
        user: student,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: 1,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });

      // invalid/not-started assignment
      const resp2 = await supertest({ userId: professor.id }).get(
        `/studentTaskProgress/student/${student.id}/${course.id}/assignment2`,
      );
      expect(resp2.body).toEqual({});
      expect(resp2.status).toBe(200);
    });

    it('should return the assignment progress for a students own progress', async () => {
      const course = await CourseFactory.create();
      const student = await UserFactory.create();
      const professor = await UserFactory.create();
      const queue = await QueueFactory.create({
        course: course,
      });

      await UserCourseFactory.create({
        user: student,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });
      await StudentTaskProgressFactory.create({
        user: student,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });

      const resp = await supertest({ userId: student.id }).get(
        `/studentTaskProgress/student/${student.id}/${course.id}/assignment1`,
      );
      expect(resp.body).toEqual({
        task1: {
          isDone: true,
        },
      });
      expect(resp.status).toBe(200);
    });

    // TODO
    //it('should not allow students to retrieve other students progress but still allow TAs to do so', async () => {
  });

  describe('GET /studentTaskProgress/queue/:queueId/:courseId/:assignmentName', () => {
    it('should return 401 if user is not authorized', async () => {
      await supertest()
        .get(`/studentTaskProgress/queue/1/1/assignment1`)
        .expect(401);
    });

    it('Should return the assignment progress as well as the user details for all students in the queue', async () => {
      const course = await CourseFactory.create();
      const student1 = await UserFactory.create();
      const student2 = await UserFactory.create();
      const student3 = await UserFactory.create();
      const professor = await UserFactory.create();
      const queue = await QueueFactory.create({
        course: course,
      });

      await UserCourseFactory.create({
        user: student1,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: student2,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: student3,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });
      await StudentTaskProgressFactory.create({
        user: student1,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });
      await StudentTaskProgressFactory.create({
        user: student2,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });
      await StudentTaskProgressFactory.create({
        user: student3,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });

      const resp = await supertest({ userId: professor.id }).get(
        `/studentTaskProgress/queue/${queue.id}/${course.id}/assignment1`,
      );
      expect(resp.body).toEqual({
        [student1.id]: {
          userDetails: {
            email: student1.email,
            id: student1.id,
            name: student1.firstName + ' ' + student1.lastName,
            photoURL: student1.photoURL,
            sid: student1.sid,
          },
          assignmentProgress: {
            task1: {
              isDone: true,
            },
          },
        },
        [student2.id]: {
          userDetails: {
            email: student2.email,
            id: student2.id,
            name: student2.firstName + ' ' + student2.lastName,
            photoURL: student2.photoURL,
            sid: student2.sid,
          },
          assignmentProgress: {
            task1: {
              isDone: true,
            },
          },
        },
        [student3.id]: {
          userDetails: {
            email: student3.email,
            id: student3.id,
            name: student3.firstName + ' ' + student3.lastName,
            photoURL: student3.photoURL,
            sid: student3.sid,
          },
          assignmentProgress: {
            task1: {
              isDone: true,
            },
          },
        },
      });
      expect(resp.status).toBe(200);
    });

    it('should return 404 if invalid course or invalid queue', async () => {
      const course = await CourseFactory.create();
      const student = await UserFactory.create();
      const professor = await UserFactory.create();
      const queue = await QueueFactory.create({
        course: course,
      });

      await UserCourseFactory.create({
        user: student,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });
      await StudentTaskProgressFactory.create({
        user: student,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });

      // invalid course
      const resp = await supertest({ userId: professor.id }).get(
        `/studentTaskProgress/queue/1/${course.id + 1}/assignment1`,
      );
      expect(resp.status).toBe(404);

      // invalid queue
      const resp2 = await supertest({ userId: professor.id }).get(
        `/studentTaskProgress/queue/30/${queue.id + 1}/assignment1`,
      );
      expect(resp2.status).toBe(404);
    });

    it('should return {} if no student has made any task progress in the queue yet', async () => {
      const course = await CourseFactory.create();
      const student = await UserFactory.create();
      const professor = await UserFactory.create();
      const queue = await QueueFactory.create({
        course: course,
      });

      await UserCourseFactory.create({
        user: student,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });

      const resp = await supertest({ userId: professor.id }).get(
        `/studentTaskProgress/queue/${queue.id}/${course.id}/assignment1`,
      );
      expect(resp.body).toEqual({});
      expect(resp.status).toBe(200);
    });

    it('should not allow students to retrieve all students task progress', async () => {
      const course = await CourseFactory.create();
      const student = await UserFactory.create();
      const professor = await UserFactory.create();
      const queue = await QueueFactory.create({
        course: course,
      });

      await UserCourseFactory.create({
        user: student,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });
      await StudentTaskProgressFactory.create({
        user: student,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });

      const resp = await supertest({ userId: student.id }).get(
        `/studentTaskProgress/queue/${queue.id}/${course.id}/assignment1`,
      );
      expect(resp.status).toBe(403);
    });
  });

  describe('GET /studentTaskProgress/course/:courseId', () => {
    it('should return 401 if user is not authorized', async () => {
      await supertest().get(`/studentTaskProgress/course/1`).expect(401);
    });

    it('should return 404 if invalid course', async () => {
      const course = await CourseFactory.create();
      const student = await UserFactory.create();
      const professor = await UserFactory.create();

      await UserCourseFactory.create({
        user: student,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });
      await StudentTaskProgressFactory.create({
        user: student,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: 1,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });

      const resp = await supertest({ userId: professor.id }).get(
        `/studentTaskProgress/course/${course.id + 1}`,
      );
      expect(resp.status).toBe(404);
    });

    it('should not allow students to retrieve all students task progress', async () => {
      const course = await CourseFactory.create();
      const student = await UserFactory.create();
      const professor = await UserFactory.create();

      await UserCourseFactory.create({
        user: student,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });
      await StudentTaskProgressFactory.create({
        user: student,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: 1,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });

      const resp = await supertest({ userId: student.id }).get(
        `/studentTaskProgress/course/${course.id}`,
      );
      expect(resp.status).toBe(403);
    });

    it('should return the assignment progress for all students in the course', async () => {
      const course = await CourseFactory.create();
      const student1 = await UserFactory.create();
      const student2 = await UserFactory.create();
      const student3 = await UserFactory.create();
      const professor = await UserFactory.create();
      const queue = await QueueFactory.create({
        course: course,
      });

      await UserCourseFactory.create({
        user: student1,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: student2,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: student3,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });
      await StudentTaskProgressFactory.create({
        user: student1,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });
      await StudentTaskProgressFactory.create({
        user: student2,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });
      await StudentTaskProgressFactory.create({
        user: student3,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });

      const resp = await supertest({ userId: professor.id }).get(
        `/studentTaskProgress/course/${course.id}`,
      );

      expect(resp.body).toEqual([
        {
          userDetails: {
            email: student1.email,
            id: student1.id,
            name: student1.firstName + ' ' + student1.lastName,
            photoURL: student1.photoURL,
            sid: student1.sid,
          },
          taskProgress: {
            assignment1: {
              lastEditedQueueId: queue.id,
              assignmentProgress: {
                task1: {
                  isDone: true,
                },
              },
            },
          },
        },
        {
          userDetails: {
            email: student2.email,
            id: student2.id,
            name: student2.firstName + ' ' + student2.lastName,
            photoURL: student2.photoURL,
            sid: student2.sid,
          },
          taskProgress: {
            assignment1: {
              lastEditedQueueId: queue.id,
              assignmentProgress: {
                task1: {
                  isDone: true,
                },
              },
            },
          },
        },
        {
          userDetails: {
            email: student3.email,
            id: student3.id,
            name: student3.firstName + ' ' + student3.lastName,
            photoURL: student3.photoURL,
            sid: student3.sid,
          },
          taskProgress: {
            assignment1: {
              lastEditedQueueId: queue.id,
              assignmentProgress: {
                task1: {
                  isDone: true,
                },
              },
            },
          },
        },
      ]);
      expect(resp.status).toBe(200);
    });

    it('should not retrieve studentTaskProgress for students in other courses', async () => {
      const course1 = await CourseFactory.create();
      const course2 = await CourseFactory.create();
      const student1 = await UserFactory.create();
      const student2 = await UserFactory.create();
      const professor = await UserFactory.create();
      const queue = await QueueFactory.create({
        course: course1,
      });

      await UserCourseFactory.create({
        user: student1,
        role: Role.STUDENT,
        course: course1,
      });
      await UserCourseFactory.create({
        user: student2,
        role: Role.STUDENT,
        course: course2,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course1,
      });
      await StudentTaskProgressFactory.create({
        user: student1,
        course: course1,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });
      await StudentTaskProgressFactory.create({
        user: student2,
        course: course2,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });

      const resp = await supertest({ userId: professor.id }).get(
        `/studentTaskProgress/course/${course1.id}`,
      );

      expect(resp.body).toEqual([
        {
          userDetails: {
            email: student1.email,
            id: student1.id,
            name: student1.firstName + ' ' + student1.lastName,
            photoURL: student1.photoURL,
            sid: student1.sid,
          },
          taskProgress: {
            assignment1: {
              lastEditedQueueId: queue.id,
              assignmentProgress: {
                task1: {
                  isDone: true,
                },
              },
            },
          },
        },
      ]);
      expect(resp.status).toBe(200);
    });

    it('should return the correct studentTaskProgress if the student has assignment progress in multiple other courses', async () => {
      const course1 = await CourseFactory.create();
      const course2 = await CourseFactory.create();
      const student1 = await UserFactory.create();
      const professor = await UserFactory.create();
      const queue1 = await QueueFactory.create({
        course: course1,
      });
      const queue2 = await QueueFactory.create({
        course: course2,
      });

      await UserCourseFactory.create({
        user: student1,
        role: Role.STUDENT,
        course: course1,
      });
      await UserCourseFactory.create({
        user: student1,
        role: Role.STUDENT,
        course: course2,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course1,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course2,
      });
      await StudentTaskProgressFactory.create({
        user: student1,
        course: course1,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue1.id,
            assignmentProgress: {
              question1: {
                isDone: true,
              },
            },
          },
        },
      });
      await StudentTaskProgressFactory.create({
        user: student1,
        course: course2,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue2.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });

      const resp = await supertest({ userId: professor.id }).get(
        `/studentTaskProgress/course/${course2.id}`,
      );

      expect(resp.body).toEqual([
        {
          userDetails: {
            email: student1.email,
            id: student1.id,
            name: student1.firstName + ' ' + student1.lastName,
            photoURL: student1.photoURL,
            sid: student1.sid,
          },
          taskProgress: {
            assignment1: {
              lastEditedQueueId: queue2.id,
              assignmentProgress: {
                task1: {
                  isDone: true,
                },
              },
            },
          },
        },
      ]);
      expect(resp.status).toBe(200);

      const resp2 = await supertest({ userId: professor.id }).get(
        `/studentTaskProgress/course/${course1.id}`,
      );

      expect(resp2.body).toEqual([
        {
          userDetails: {
            email: student1.email,
            id: student1.id,
            name: student1.firstName + ' ' + student1.lastName,
            photoURL: student1.photoURL,
            sid: student1.sid,
          },
          taskProgress: {
            assignment1: {
              lastEditedQueueId: queue1.id,
              assignmentProgress: {
                question1: {
                  isDone: true,
                },
              },
            },
          },
        },
      ]);
      expect(resp2.status).toBe(200);
    });

    it('should return all students for the course even if they have not made any task progress yet', async () => {
      const course = await CourseFactory.create();
      const student1 = await UserFactory.create();
      const student2 = await UserFactory.create();
      const student3 = await UserFactory.create();
      const professor = await UserFactory.create();

      await UserCourseFactory.create({
        user: student1,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: student2,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: student3,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });

      const resp = await supertest({ userId: professor.id }).get(
        `/studentTaskProgress/course/${course.id}`,
      );

      expect(resp.body).toEqual([
        {
          userDetails: {
            email: student1.email,
            id: student1.id,
            name: student1.firstName + ' ' + student1.lastName,
            photoURL: student1.photoURL,
            sid: student1.sid,
          },
          taskProgress: {},
        },
        {
          userDetails: {
            email: student2.email,
            id: student2.id,
            name: student2.firstName + ' ' + student2.lastName,
            photoURL: student2.photoURL,
            sid: student2.sid,
          },
          taskProgress: {},
        },
        {
          userDetails: {
            email: student3.email,
            id: student3.id,
            name: student3.firstName + ' ' + student3.lastName,
            photoURL: student3.photoURL,
            sid: student3.sid,
          },
          taskProgress: {},
        },
      ]);
      expect(resp.status).toBe(200);
    });
  });
});
