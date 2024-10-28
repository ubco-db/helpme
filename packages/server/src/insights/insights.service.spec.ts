import { Test, TestingModule } from '@nestjs/testing';
import { CacheModule } from '@nestjs/common';
import { TestTypeOrmModule } from '../../test/util/testUtils';
import { Connection } from 'typeorm';
import { InsightsService } from './insights.service';
import {
  AsyncQuestionFactory,
  CourseFactory,
  InteractionFactory,
  QuestionFactory,
  QuestionTypeFactory,
  QueueFactory,
  UserCourseFactory,
  UserFactory,
  VotesFactory,
} from '../../test/util/factories';
import { INSIGHTS_MAP } from './insight-objects';
import { UserModel } from 'profile/user.entity';
import {
  asyncQuestionStatus,
  ChartOutputType,
  ClosedQuestionStatus,
  GanttChartOutputType,
  MultipleGanttChartOutputType,
  Question,
  Role,
  TableOutputType,
} from '@koh/common';

describe('InsightsService', () => {
  let service: InsightsService;
  let conn: Connection;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, CacheModule.register()],
      providers: [InsightsService],
    }).compile();

    service = module.get<InsightsService>(InsightsService);
    conn = module.get<Connection>(Connection);
  });

  afterAll(async () => {
    await conn.close();
  });

  beforeEach(async () => {
    await conn.synchronize(true);
  });

  describe('computeOutput', () => {
    it('totalStudents', async () => {
      const course = await CourseFactory.create();
      await UserCourseFactory.createList(4, { course });
      await UserCourseFactory.create();

      const res = await service.computeOutput({
        insight: INSIGHTS_MAP.TotalStudents,
        filters: [
          {
            type: 'courseId',
            courseId: course.id,
          },
        ],
      });
      expect(res).toEqual(4);
    });

    it('totalQuestionsAsked', async () => {
      const course = await CourseFactory.create();
      const queue = await QueueFactory.create({ course });
      // questions in the past
      await QuestionFactory.createList(6, {
        queue,
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      });
      // question right now
      await QuestionFactory.create({ queue });

      const res = await service.computeOutput({
        insight: INSIGHTS_MAP.TotalQuestionsAsked,
        filters: [
          {
            type: 'courseId',
            courseId: course.id,
          },
          {
            type: 'timeframe',
            start: new Date(Date.now() - 36 * 60 * 1000),
            end: new Date(Date.now() - 6 * 60 * 1000),
          },
        ],
      });
      expect(res).toEqual(6);
    });

    it('medianWaitTime', async () => {
      const course = await CourseFactory.create();
      const queue = await QueueFactory.create({ course });
      await QuestionFactory.createList(20, {
        // 5 min
        queue: queue,
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        firstHelpedAt: new Date(Date.now() - 25 * 60 * 1000),
      });
      await QuestionFactory.createList(20, {
        // 10 min
        queue: queue,
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        firstHelpedAt: new Date(Date.now() - 20 * 60 * 1000),
      });
      await QuestionFactory.createList(20, {
        // 30 min
        queue: queue,
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
        firstHelpedAt: new Date(Date.now() - 30 * 60 * 1000),
      });

      const res = await service.computeOutput({
        insight: INSIGHTS_MAP.MedianWaitTime,
        filters: [
          {
            type: 'courseId',
            courseId: course.id,
          },
        ],
      });
      expect(res).toEqual('10 min');
    });

    it('medianHelpingTime', async () => {
      const course = await CourseFactory.create();
      const queue = await QueueFactory.create({ course });
      await QuestionFactory.createList(20, {
        queue: queue,
        helpedAt: new Date(Date.now() - 30 * 60 * 1000),
        closedAt: new Date(Date.now() - 25 * 60 * 1000),
      });
      await QuestionFactory.createList(20, {
        queue: queue,
        helpedAt: new Date(Date.now() - 30 * 60 * 1000),
        closedAt: new Date(Date.now() - 20 * 60 * 1000),
      });
      await QuestionFactory.createList(20, {
        queue: queue,
        helpedAt: new Date(Date.now() - 60 * 60 * 1000),
        closedAt: new Date(Date.now() - 30 * 60 * 1000),
      });

      const res = await service.computeOutput({
        insight: INSIGHTS_MAP.MedianHelpingTime,
        filters: [
          {
            type: 'courseId',
            courseId: course.id,
          },
        ],
      });
      expect(res).toEqual('10 min');
    });

    it('questionToStudentRatio', async () => {
      const course = await CourseFactory.create();
      const queue = await QueueFactory.create({ course });
      // questions in the past
      await QuestionFactory.createList(20, {
        queue,
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      });
      // question right now
      await QuestionFactory.create({ queue });
      // students in the class
      await UserCourseFactory.createList(4, { course });

      const res = await service.computeOutput({
        insight: INSIGHTS_MAP.QuestionToStudentRatio,
        filters: [
          {
            type: 'courseId',
            courseId: course.id,
          },
          {
            type: 'timeframe',
            start: new Date(Date.now() - 36 * 60 * 1000),
            end: new Date(Date.now() - 6 * 60 * 1000),
          },
        ],
      });
      expect(parseFloat(res as string) - 5).toBeLessThanOrEqual(0.001);
    });
  });

  it('questionTypeBreakdown', async () => {
    const course = await CourseFactory.create();
    const queue = await QueueFactory.create({ course });
    const bugType = await QuestionTypeFactory.create({ name: 'Bug' });
    const clarificationType = await QuestionTypeFactory.create({
      name: 'Clarification',
    });
    const testingType = await QuestionTypeFactory.create({ name: 'Testing' });

    await QuestionFactory.createList(8, {
      questionTypes: [bugType],
      queue,
    });
    await QuestionFactory.createList(20, {
      questionTypes: [clarificationType],
      queue,
    });
    await QuestionFactory.createList(10, {
      questionTypes: [testingType],
      queue,
    });
    const res = await service.computeOutput({
      insight: INSIGHTS_MAP.QuestionTypeBreakdown,
      filters: [
        {
          type: 'courseId',
          courseId: course.id,
        },
      ],
    });

    const output = res as ChartOutputType;

    const expectedQuestionTypes = [
      { questionTypeName: 'Bug', totalQuestions: 8 },
      { questionTypeName: 'Clarification', totalQuestions: 20 },
      { questionTypeName: 'Testing', totalQuestions: 10 },
    ];

    expect(output.data).toEqual(expectedQuestionTypes);
  });

  it('mostActiveStudents', async () => {
    const course = await CourseFactory.create();
    const queue = await QueueFactory.create({ course });
    const user1 = await UserFactory.create({
      id: 1,
      firstName: 'Derek',
      lastName: 'Jeter',
      email: 'jeter.d@northeastern.edu',
    });
    const user2 = await UserFactory.create({
      id: 2,
      firstName: 'David',
      lastName: 'Wright',
      email: 'wright.da@northeastern.edu',
    });
    const user3 = await UserFactory.create({
      id: 3,
      firstName: 'Adam',
      lastName: 'Smith',
      email: 'smith.a@northeastern.edu',
    });
    const user4 = await UserFactory.create({
      id: 4,
      firstName: 'Jean',
      lastName: 'Valjean',
      email: 'valjean.j@protonmail.com',
    });
    await QuestionFactory.createList(8, {
      creator: user1,
      queue,
    });
    await QuestionFactory.createList(20, {
      creator: user2,
      queue,
    });
    await QuestionFactory.createList(10, {
      creator: user3,
      queue,
    });
    await QuestionFactory.createList(110, {
      creator: user4,
      queue,
    });
    const res = await service.computeOutput({
      insight: INSIGHTS_MAP.MostActiveStudents,
      filters: [
        {
          type: 'courseId',
          courseId: course.id,
        },
      ],
    });

    const output = res as TableOutputType;

    expect(output.data).toEqual([
      {
        studentName: 'Jean Valjean (4)',
        email: 'valjean.j@protonmail.com',
        questionsAsked: '110',
      },
      {
        studentName: 'David Wright (2)',
        email: 'wright.da@northeastern.edu',
        questionsAsked: '20',
      },
      {
        studentName: 'Adam Smith (3)',
        email: 'smith.a@northeastern.edu',
        questionsAsked: '10',
      },
      {
        studentName: 'Derek Jeter (1)',
        email: 'jeter.d@northeastern.edu',
        questionsAsked: '8',
      },
    ]);
  });

  it('averageTimesByWeekDay', async () => {
    const student = await UserFactory.create();
    const ta = await UserFactory.create();
    const course = await CourseFactory.create();
    const queue = await QueueFactory.create({ course: course });

    const weekdayTimes = {
      monday: '2024-09-09',
      tuesday: '2024-09-10',
      wednesday: '2024-09-11',
      thursday: '2024-09-12',
      friday: '2024-09-13',
    };

    for (const key of Object.keys(weekdayTimes)) {
      const index = Object.keys(weekdayTimes).indexOf(key);
      const daytime = weekdayTimes[key];
      const duration = 10 * (index + 1);
      const helptime = daytime + `T12:${duration}:00.000Z`;
      const closetime = daytime + `T12:${duration + 5}:00.000Z`;

      await QuestionFactory.create({
        creator: student,
        taHelped: ta,
        queue: queue,
        status: 'Resolved',
        createdAt: new Date(Date.parse(daytime + 'T12:00:00.000Z')),
        helpedAt: new Date(Date.parse(helptime)),
        firstHelpedAt: new Date(Date.parse(helptime)),
        closedAt: new Date(Date.parse(closetime)),
      });
    }

    const res = (await service.computeOutput({
      insight: INSIGHTS_MAP.AverageTimesByWeekDay,
      filters: [
        {
          type: 'courseId',
          courseId: course.id,
        },
      ],
    })) as ChartOutputType;

    expect(res.data).toMatchSnapshot();
    expect(res.xType).toBe('category');
    expect(res.xKey).toBe('weekday');
    expect(res.yKeys).toEqual([
      'Average_Wait_Time',
      'Average_Help_Time',
      'Total_Time',
    ]);
  });

  it('mostActiveTimes', async () => {
    const student = await UserFactory.create();
    const ta = await UserFactory.create();
    const course = await CourseFactory.create();
    const queue = await QueueFactory.create({ course: course });

    const expected = [];
    for (let i = 8; i <= 20; i++) {
      const date = new Date(
        Date.parse(`2024-09-09T${i < 10 ? '0' + i : i}:12:00.000`),
      );
      const minsAfterMidnight =
        (date.getTime() - Date.parse('2024-09-09T12:00:00')) / 60000;
      const rounded = Math.ceil(minsAfterMidnight / 15) * 15;

      expected.push({
        time: rounded,
        Amount: 1,
        Weekday: 1,
      });

      await QuestionFactory.create({
        creator: student,
        taHelped: ta,
        queue: queue,
        status: 'Resolved',
        createdAt: date,
        firstHelpedAt: date,
        helpedAt: date,
        closedAt: date,
      });
    }

    const res = (await service.computeOutput({
      insight: INSIGHTS_MAP.MostActiveTimes,
      filters: [
        {
          type: 'courseId',
          courseId: course.id,
        },
      ],
    })) as GanttChartOutputType;

    expect(res.data).toMatchSnapshot();
    expect(res.xKey).toBe('time');
    expect(res.yKey).toBe('Weekday');
    expect(res.zKey).toBe('Amount');
    expect(res.numCategories).toBe(7);
  }, 10000);

  it('helpSeekingOverTime', async () => {
    const student = await UserFactory.create();
    const course = await CourseFactory.create();
    const queue = await QueueFactory.create({ course: course });

    const startTime = new Date('2024-09-01T12:00:00'),
      endTime = new Date('2024-09-30T12:00:00');

    for (let i = 0; i < 30; i++) {
      const time = new Date(startTime.getTime() + i * 1000 * 60 * 60 * 24);
      await QuestionFactory.create({
        creator: student,
        queue: queue,
        createdAt: time,
      });
      await AsyncQuestionFactory.create({
        creator: student,
        course: course,
        createdAt: time,
      });
      await InteractionFactory.create({
        user: student,
        course: course,
        timestamp: time,
      });
    }

    const res = (await service.computeOutput({
      insight: INSIGHTS_MAP.HelpSeekingOverTime,
      filters: [
        {
          type: 'courseId',
          courseId: course.id,
        },
        {
          type: 'timeframe',
          start: startTime.toDateString(),
          end: endTime.toDateString(),
        },
      ],
    })) as ChartOutputType;

    expect(res.data).toMatchSnapshot();
    expect(res.xKey).toEqual('date');
    expect(res.yKeys).toEqual([
      'Questions',
      'Async_Questions',
      'Chatbot_Interactions',
    ]);
  }, 30000);

  it('humanVsChatbot', async () => {
    const student = await UserFactory.create();
    const course = await CourseFactory.create();

    await AsyncQuestionFactory.createList(4, {
      creator: student,
      course: course,
      status: asyncQuestionStatus.AIAnsweredResolved,
      verified: true,
    });
    await AsyncQuestionFactory.createList(6, {
      creator: student,
      course: course,
      status: asyncQuestionStatus.AIAnswered,
    });
    await AsyncQuestionFactory.createList(2, {
      creator: student,
      course: course,
      status: asyncQuestionStatus.AIAnsweredNeedsAttention,
    });
    const expectedAI = 12,
      expectedAIVerified = 4;

    await AsyncQuestionFactory.createList(3, {
      creator: student,
      course: course,
      status: asyncQuestionStatus.HumanAnswered,
      verified: true,
    });
    await AsyncQuestionFactory.createList(5, {
      creator: student,
      course: course,
      status: asyncQuestionStatus.HumanAnswered,
    });
    const expectedHuman = 8,
      expectedHumanVerified = 3;

    const res = (await service.computeOutput({
      insight: INSIGHTS_MAP.HumanVsChatbot,
      filters: [
        {
          type: 'courseId',
          courseId: course.id,
        },
      ],
    })) as ChartOutputType;

    expect(res.data).toEqual([
      {
        type: 'Human',
        Answered: expectedHuman,
        Verified: expectedHumanVerified,
      },
      {
        type: 'Chatbot',
        Answered: expectedAI,
        Verified: expectedAIVerified,
      },
    ]);
    expect(res.xKey).toEqual('type');
    expect(res.yKeys).toEqual(['Answered', 'Verified']);
  });

  it('humanVsChatbotVotes', async () => {
    const student = await UserFactory.create();
    const students = [];
    for (let i = 0; i < 4; i++) {
      students.push(await UserFactory.create());
    }
    const course = await CourseFactory.create();

    const ai_questions = await AsyncQuestionFactory.createList(4, {
      creator: student,
      course: course,
      status: asyncQuestionStatus.AIAnsweredResolved,
      verified: true,
    });
    for (const question of ai_questions) {
      for (const student of students) {
        await VotesFactory.create({
          question,
          user: student,
          vote: 1,
        });
      }
    }

    const human_questions = await AsyncQuestionFactory.createList(4, {
      creator: student,
      course: course,
      status: asyncQuestionStatus.HumanAnswered,
      verified: true,
    });
    for (const question of human_questions) {
      for (const student of students) {
        await VotesFactory.create({
          question,
          user: student,
          vote: 1,
        });
      }
    }

    const res = (await service.computeOutput({
      insight: INSIGHTS_MAP.HumanVsChatbotVotes,
      filters: [
        {
          type: 'courseId',
          courseId: course.id,
        },
      ],
    })) as ChartOutputType;

    expect(res.data).toEqual([
      {
        type: 'Human',
        Total_Score: 16,
        Total_Votes: 16,
      },
      {
        type: 'Chatbot',
        Total_Score: 16,
        Total_Votes: 16,
      },
    ]);
    expect(res.xKey).toEqual('type');
    expect(res.yKeys).toEqual(['Total_Score', 'Total_Votes']);
  });

  it('staffWorkload', async () => {
    const course = await CourseFactory.create({ id: 1 });
    const student = await UserFactory.create({ id: 0 });
    const queue = await QueueFactory.create({ course: course });
    await UserCourseFactory.create({
      course: course,
      user: student,
      role: Role.STUDENT,
    });
    const tas = [];
    for (let i = 1; i < 5; i++) {
      tas.push(
        await UserFactory.create({
          id: i,
        }),
      );
      await UserCourseFactory.create({
        course: course,
        user: tas[i],
        role: Role.TA,
      });
    }
    const weekdayTimes: { [key: string]: string } = {
      monday: '2024-09-09T08:00:00',
      tuesday: '2024-09-10T08:00:00',
      wednesday: '2024-09-11T08:00:00',
      thursday: '2024-09-12T08:00:00',
      friday: '2024-09-13T08:00:00',
    };
    const taQuestions: { [key: number]: Question[] } = [];
    for (const ta of tas) {
      taQuestions[ta.id] = await QuestionFactory.createList(25, {
        taHelpedId: ta.id,
        creator: student,
        status: ClosedQuestionStatus.Resolved,
        queue,
      });
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const question = taQuestions[ta.id][j + i * 5];
          const date = new Date(weekdayTimes[Object.keys(weekdayTimes)[j]]);
          question.createdAt = new Date(date.getTime() + 15 * 60 * 1000);
          question.helpedAt = new Date(date.getTime() + 10 * 60 * 1000);
          question.closedAt = new Date(date.getTime() + 15 * 60 * 1000);
        }
      }
    }

    const res = (await service.computeOutput({
      insight: INSIGHTS_MAP.StaffWorkload,
      filters: [
        {
          type: 'courseId',
          courseId: course.id,
        },
      ],
    })) as MultipleGanttChartOutputType;

    expect(res.length).toBeGreaterThan(0);
    res.forEach((res0) => {
      expect(res0.data).toMatchSnapshot();
      expect(res0.xKey).toEqual('time');
      expect(res0.yKey).toEqual('Staff_Member');
      expect(res0.zKey).toEqual('Amount');
    });
  }, 10000);

  it('staffEfficiency', async () => {
    const course = await CourseFactory.create({ id: 1 });
    const student = await UserFactory.create({ id: 0 });
    const queue = await QueueFactory.create({ course: course });
    await UserCourseFactory.create({
      course: course,
      user: student,
      role: Role.STUDENT,
    });
    const tas = [];
    for (let i = 1; i < 5; i++) {
      tas.push(
        await UserFactory.create({
          id: i,
        }),
      );
      await UserCourseFactory.create({
        course: course,
        user: tas[i],
        role: Role.TA,
      });
    }
    const weekdayTimes: { [key: string]: string } = {
      monday: '2024-09-09T08:00:00',
      tuesday: '2024-09-10T08:00:00',
      wednesday: '2024-09-11T08:00:00',
      thursday: '2024-09-12T08:00:00',
      friday: '2024-09-13T08:00:00',
    };
    const taQuestions: { [key: number]: Question[] } = [];
    for (const ta of tas) {
      taQuestions[ta.id] = await QuestionFactory.createList(25, {
        taHelpedId: ta.id,
        creator: student,
        status: ClosedQuestionStatus.Resolved,
        queue,
      });
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const question = taQuestions[ta.id][j + i * 5];
          const date = new Date(weekdayTimes[Object.keys(weekdayTimes)[j]]);
          question.createdAt = new Date(date.getTime() + 15 * 60 * 1000);
          question.helpedAt = new Date(date.getTime() + 10 * 60 * 1000);
          question.closedAt = new Date(date.getTime() + 15 * 60 * 1000);
        }
      }
    }

    const res = (await service.computeOutput({
      insight: INSIGHTS_MAP.StaffEfficiency,
      filters: [
        {
          type: 'courseId',
          courseId: course.id,
        },
      ],
    })) as ChartOutputType;

    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data).toMatchSnapshot();
    expect(res.xKey).toEqual('staffMember');
    expect(res.yKeys).toEqual([
      'Average_Wait_Time',
      'Average_Help_Time',
      'Total_Time',
    ]);
  }, 10000);

  it('staffTotalHelped', async () => {
    const course = await CourseFactory.create({ id: 1 });
    const student = await UserFactory.create({ id: 0 });
    const queue = await QueueFactory.create({ course: course });
    await UserCourseFactory.create({
      course: course,
      user: student,
      role: Role.STUDENT,
    });
    const tas = [];
    for (let i = 1; i < 5; i++) {
      tas.push(
        await UserFactory.create({
          id: i,
        }),
      );
      await UserCourseFactory.create({
        course: course,
        user: tas[i],
        role: Role.TA,
      });
    }
    const weekdayTimes: { [key: string]: string } = {
      monday: '2024-09-09T08:00:00',
      tuesday: '2024-09-10T08:00:00',
      wednesday: '2024-09-11T08:00:00',
      thursday: '2024-09-12T08:00:00',
      friday: '2024-09-13T08:00:00',
    };
    const taQuestions: { [key: number]: Question[] } = [];
    for (const ta of tas) {
      taQuestions[ta.id] = await QuestionFactory.createList(25, {
        taHelpedId: ta.id,
        creator: student,
        status: ClosedQuestionStatus.Resolved,
        queue,
      });
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const question = taQuestions[ta.id][j + i * 5];
          const date = new Date(weekdayTimes[Object.keys(weekdayTimes)[j]]);
          question.createdAt = new Date(date.getTime() + 15 * 60 * 1000);
          question.helpedAt = new Date(date.getTime() + 10 * 60 * 1000);
          question.closedAt = new Date(date.getTime() + 15 * 60 * 1000);
        }
      }
    }

    const res = (await service.computeOutput({
      insight: INSIGHTS_MAP.StaffTotalHelped,
      filters: [
        {
          type: 'courseId',
          courseId: course.id,
        },
      ],
    })) as ChartOutputType;

    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data).toMatchSnapshot();
    expect(res.xKey).toEqual('staffMember');
    expect(res.yKeys).toEqual([
      'Questions_Helped',
      'Async_Questions_Helped',
      'Total_Helped',
    ]);
  }, 10000);

  describe('toggleInsightOn', () => {
    it('works correctly', async () => {
      const userFactory = await UserFactory.create();
      const user = await UserModel.findOne(userFactory.id);
      expect(user.hideInsights).toStrictEqual([]);
      await service.toggleInsightOff(user, 'questionTypeBreakdown');
      await user.reload();
      expect(user.hideInsights).toStrictEqual(['questionTypeBreakdown']);
    });
  });

  describe('toggleInsightOff', () => {
    it('works correctly', async () => {
      const userFactory = await UserFactory.create({
        hideInsights: ['questionTypeBreakdown'],
      });
      const user = await UserModel.findOne(userFactory.id);
      expect(user.hideInsights).toStrictEqual(['questionTypeBreakdown']);
      await service.toggleInsightOn(user, 'questionTypeBreakdown');
      await user.reload();
      expect(user.hideInsights).toStrictEqual([]);
    });
  });
});
