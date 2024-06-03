// import { Role } from '@koh/common';
// import {
//   Controller,
//   UseGuards,
//   UseInterceptors,
//   ClassSerializerInterceptor,
//   Body,
//   Delete,
//   Get,
//   Param,
//   Post,
//   Res,
// } from '@nestjs/common';
// import { Roles } from 'decorators/roles.decorator';
// import { JwtAuthGuard } from 'guards/jwt-auth.guard';
// import { Connection } from 'typeorm';
// import { StudentTaskProgressModel } from './studentTaskProgress.entity';
// import { Response } from 'express';
// import { UserModel } from 'profile/user.entity';
// import { QueueModel } from 'queue/queue.entity';
// import { CourseModel } from 'course/course.entity';

// @Controller('studentTaskProgress')
// @UseGuards(JwtAuthGuard)
// @UseInterceptors(ClassSerializerInterceptor)
// export class StudentTaskProgressController {
//   constructor(private connection: Connection) {}

//   // takes in 3 inputs (queueId, userId, and sessionName) and returns the student's task progress as a JSON
//   // TODO: prevent students from being able to see other students' task progress while still allowing TAs and professors to see all students' task progress
//   // technically a POST and a PATCH since it both can create a new studentTaskProgress and partially update an existing one
//   @Post('studentTaskProgress/:cid/:qid/:uid')
//   @Roles(Role.TA, Role.PROFESSOR, Role.STUDENT)
//   async setStudentTaskProgress(
//     @Res() res: Response,
//     @Param('cid') courseId: number,
//     @Param('qid') queueId: number,
//     @Param('uid') userId: number,
//     @Body('sessionName') sessionName: string,
//     @Body('taskProgressJSON') taskProgressJSON: object, // e.g. { "task1": {"isDone": true}, "task2": {"isDone": false} }
//   ): Promise<void> {
//     // first check if user exists
//     try {
//       await UserModel.findOneOrFail(userId);
//     } catch (err) {
//       res.status(400).send('User does not exist');
//       return;
//     }

//     // then check if the course exists
//     try {
//       await CourseModel.findOneOrFail(courseId);
//     } catch (err) {
//       res.status(400).send('Course does not exist');
//       return;
//     }

//     // then check if queue exists.
//     let queue;
//     try {
//       queue = await QueueModel.findOneOrFail(queueId);
//     } catch (err) {
//       res.status(400).send('Queue does not exist');
//       return;
//     }

//     // If it does, use the queue's currentQueueSessionId to get the current queueSession
//     const currentQueueSession = queue.currentQueueSession;
//     // and use that to find the name of the current lab session
//     const currentConfig = currentQueueSession.queueSessionConfig;
//     const currentSessionName = Object.keys(currentConfig)[0]; // { "lab1": {config stuff} } => "lab1"

//     // and then check if the sessionName matches the current lab session
//     // (prevents it from being retroactively changed e.g. in the case a clever student tries to go back and change all of their previous checks to true,
//     // however, this may be changed later in case we add a way for professors to retroactively change task completeness, but that should be its own separate endpoint)
//     if (sessionName !== currentSessionName) {
//       res
//         .status(400)
//         .send(
//           'You cannot modify the task progress for lab or session that is not in session',
//         );
//       return;
//     }

//     //
//     // now, create the studentTaskProgress
//     //

//     // first, get the studentTaskProgress for the student (if it exists already)
//     let currentStudentTaskProgress: StudentTaskProgressModel;
//     try {
//       currentStudentTaskProgress = await StudentTaskProgressModel.findOne({
//         where: {
//           uid: userId,
//           cid: courseId,
//         },
//       });
//     } catch (err) {
//       res.status(400).send('Error while finding student task progress');
//       return;
//     }

//     let newTaskProgress;
//     if (
//       currentStudentTaskProgress === undefined ||
//       currentStudentTaskProgress.taskProgress === undefined
//     ) {
//       // if studentTaskProgress doesn't exist yet for the student, create it and append the new task
//       newTaskProgress = { sessionName: taskProgressJSON };
//     } else if (
//       currentStudentTaskProgress.taskProgress[sessionName] === undefined
//     ) {
//       // if studentTaskProgress exists, but doesn't have anything for this session yet, create it
//       newTaskProgress = currentStudentTaskProgress.taskProgress;
//       newTaskProgress[sessionName] = taskProgressJSON;
//       newTaskProgress = { sessionName: newTaskProgress };
//     } else {
//       // if studentTaskProgress exists, check to see if this each task is a new task
//       // if it is a new task, append it to the studentTaskProgress
//       // if it is an existing task, update the studentTaskProgress
//       newTaskProgress = currentStudentTaskProgress.taskProgress;
//       for (const task in taskProgressJSON) {
//         // if (newTaskProgress[task] === undefined) {
//         newTaskProgress[sessionName][task] = taskProgressJSON[task];
//       }
//     }

//     // save the new student task progress
//     try {
//       await StudentTaskProgressModel.create({
//         uid: userId,
//         cid: courseId,
//         taskProgress: newTaskProgress,
//       }).save();
//       res.status(200).send('success');
//     } catch (err) {
//       res.status(400).send('Error while saving student task progress');
//     }
//   }

//   /*
//   Obtains the student's task progress for a given sessionName in a given course.
//   e.g. If you want the tasks for "lab1", put "lab1 as the SessionName"

//   "sessionName" should not be confused with "queueSession",
//   "sessionName" is the name of the lab (e.g. "lab1"),
//   while a "queueSession" is a period of time in a queue that keeps track of what config is loaded.
//   Basically, there can be multiple "queueSessions" that have the same "sessionName"

//   This is what the studentTaskProgress JSON looks like:
//     {
//       "lab1": {
//           "task1": {"isDone": true},
//           "task2": {"isDone": false},
//       },
//       "lab2": {
//           "task1": {
//               "isDone": true
//           },
//       }
//     }

//   This is what this method returns:
//     {
//         "task1": {"isDone": true},
//         "task2": {"isDone": false},
//     }
//   */
//   @Get('studentTaskProgress/:cid/:uid')
//   @Roles(Role.TA, Role.PROFESSOR, Role.STUDENT)
//   async getStudentTaskProgress(
//     @Res() res: Response,
//     @Param('cid') courseId: number,
//     @Param('uid') userId: number,
//     @Body('sessionName') sessionName: string,
//   ): Promise<void> {
//     // first check if user exists
//     try {
//       await UserModel.findOneOrFail(userId);
//     } catch (err) {
//       res.status(400).send('User does not exist');
//       return;
//     }

//     // then check if course exists
//     try {
//       await CourseModel.findOneOrFail(courseId);
//     } catch (err) {
//       res.status(400).send('Course does not exist');
//       return;
//     }

//     // now, get the studentTaskProgress for sessionName
//     try {
//       const currentStudentTaskProgress =
//         await StudentTaskProgressModel.findOneOrFail({
//           where: {
//             uid: userId,
//             qid: courseId,
//           },
//         });
//       res
//         .status(200)
//         .send(currentStudentTaskProgress.taskProgress[sessionName]);
//     } catch (err) {
//       res.status(400).send('Student task progress does not exist');
//       return;
//     }
//   }
// }

import {
  Controller,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { Connection } from 'typeorm';

@Controller('studentTaskProgress')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class StudentTaskProgressController {
  constructor(private connection: Connection) {}
}
