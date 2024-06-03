// import {
//   BaseEntity,
//   Column,
//   Entity,
//   JoinColumn,
//   ManyToOne,
//   OneToMany,
//   PrimaryGeneratedColumn,
//   Timestamp,
// } from 'typeorm';
// import { QueueModel } from '../queue/queue.entity';
// import { QuestionTypeModel } from 'questionType/question-type.entity';
// import { Exclude } from 'class-transformer';

// /*
// "Queue Sessions" are a period of time (like a lab) that happens in a queue.
// These are needed to track what "lab" is currently being loaded, and
// more importantly: the questionTypes that are associated with this "lab".

// If we don't keep track of previous questionTypes, they would get permanently lost when they are deleted, and they are needed for insights.

// This also stores the current session config that's being used in the queue (whose id is stored in the queue table),
// as well as all previous lab configs used in the queue (which could be used for insights).

// There is also potential to connect this with the calendar entity to have them automatically start or something
// (for now, the sessions are only started when the first TA in a queue checks in)

// A similar table is the event table, which keeps track of when TAs check in and out. However,
// a seperate table is used since it would be weird to connect that table to questionType (and it's not really related)

// Technically, we can have the Profs make many queues (one for each lab (e.g. lab 1, lab 2, etc.)) and then just
// have them hide the queue once they've finished it, but that can require a lot more work from the professors to
// set up since they would need to create possibly 10+ queues (and possibly many more if they want to create a queue
// for each lab section (e.g. lab1A, lab1B, lab2A, lab2B, etc.))
// */

// @Entity('queue_session_model')
// export class QueueSessionModel extends BaseEntity {
//   @PrimaryGeneratedColumn()
//   id: number;

//   @Column()
//   @ManyToOne(() => QueueModel)
//   @JoinColumn({ name: 'qid' })
//   queue: QueueModel;

//   @Column()
//   @OneToMany(
//     () => QuestionTypeModel,
//     (questionType) => questionType.queueSession,
//   )
//   @Exclude() // not sure if this is needed on the frontend yet
//   questionTypes: QuestionTypeModel[];

//   @Column({ type: 'json' })
//   queueSessionConfig: object;

//   // startTime and endTime not used yet, but could be used for insight purposes
//   @Column()
//   startTime: Timestamp;

//   @Column()
//   endTime: Timestamp;
// }
