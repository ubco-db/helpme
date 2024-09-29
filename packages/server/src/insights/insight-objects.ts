import {
  ChartOutputType,
  InsightObject,
  InsightType,
  Role,
  StringMap,
  TableOutputType,
  ValueOutputType,
} from '@koh/common';
import { UserCourseModel } from '../profile/user-course.entity';
import { UserModel } from '../profile/user.entity';
import { QuestionModel } from '../question/question.entity';
import { createQueryBuilder, SelectQueryBuilder } from 'typeorm';
import { Cache } from 'cache-manager';
import { AsyncQuestionModel } from '../asyncQuestion/asyncQuestion.entity';
import { InteractionModel } from '../chatbot/interaction.entity';
import { AsyncQuestionVotesModel } from '../asyncQuestion/asyncQuestionVotes.entity';

export type Filter = {
  type: string;
  [x: string]: any;
};

type AddFiltersParams = {
  query: SelectQueryBuilder<any>;
  modelName: string;
  allowedFilters: string[];
  filters: Filter[];
};

function addFilters({
  query,
  modelName,
  allowedFilters,
  filters,
}: AddFiltersParams): SelectQueryBuilder<QuestionModel> {
  for (const filter of filters) {
    if (allowedFilters.includes(filter.type)) {
      APPLY_FILTER_MAP[modelName][filter.type]({ query, filter });
    }
  }
  return query;
}

type ApplyFilterParams = {
  query: SelectQueryBuilder<any>;
  filter: Filter;
};

const APPLY_FILTER_MAP = {
  QuestionModel: {
    courseId: ({ query, filter }: ApplyFilterParams) => {
      query
        .innerJoin('QuestionModel.queue', 'queue')
        .andWhere('queue."courseId" = :courseId', {
          courseId: filter.courseId,
        });
    },
    timeframe: ({ query, filter }: ApplyFilterParams) => {
      query.andWhere('QuestionModel.createdAt BETWEEN :start AND :end', {
        start: filter.start,
        end: filter.end,
      });
    },
    students: ({ query, filter }: ApplyFilterParams) => {
      query.andWhere('creatorId IN :studentIds', {
        studentIds: filter.studentIds,
      });
    },
  },
  AsyncQuestionModel: {
    courseId: ({ query, filter }: ApplyFilterParams) => {
      query.andWhere('"courseId" = :courseId', {
        courseId: filter.courseId,
      });
    },
    timeframe: ({ query, filter }: ApplyFilterParams) => {
      query.andWhere('AsyncQuestionModel.createdAt BETWEEN :start AND :end', {
        start: filter.start,
        end: filter.end,
      });
    },
    students: ({ query, filter }: ApplyFilterParams) => {
      query.andWhere('creatorId IN :studentIds', {
        studentIds: filter.studentIds,
      });
    },
  },
  InteractionModel: {
    courseId: ({ query, filter }: ApplyFilterParams) => {
      query.andWhere('"course" = :courseId', {
        course: filter.courseId,
      });
    },
    timeframe: ({ query, filter }: ApplyFilterParams) => {
      query.andWhere('InteractionModel.timestamp BETWEEN :start AND :end', {
        start: filter.start,
        end: filter.end,
      });
    },
    students: ({ query, filter }: ApplyFilterParams) => {
      query.andWhere('user IN :studentIds', {
        studentIds: filter.studentIds,
      });
    },
  },
  UserCourseModel: {
    courseId: ({ query, filter }: ApplyFilterParams) => {
      query.andWhere('"courseId" = :courseId', {
        courseId: filter.courseId,
      });
    },
  },
};

const numToWeekday = (num: number) => {
  num = parseInt(num as unknown as string);
  switch (num) {
    case 0:
      return 'Sunday';
    case 1:
      return 'Monday';
    case 2:
      return 'Tuesday';
    case 3:
      return 'Wednesday';
    case 4:
      return 'Thursday';
    case 5:
      return 'Friday';
    case 6:
      return 'Saturday';
    default:
      return 'N/A';
  }
};

export const TotalStudents: InsightObject = {
  displayName: 'Total Students',
  description:
    'What is the total number of students that are enrolled in the course?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Value,
  size: 'small' as const,
  async compute(filters): Promise<ValueOutputType> {
    return await addFilters({
      query: createQueryBuilder(UserCourseModel).where("role = 'student'"),
      modelName: UserCourseModel.name,
      allowedFilters: ['courseId', 'role'],
      filters,
    }).getCount();
  },
};

export const TotalQuestionsAsked: InsightObject = {
  displayName: 'Total Questions',
  description: 'How many questions have been asked in total?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Value,
  size: 'small' as const,
  async compute(filters): Promise<ValueOutputType> {
    return await addFilters({
      query: createQueryBuilder(QuestionModel).select(),
      modelName: QuestionModel.name,
      allowedFilters: ['courseId', 'timeframe'],
      filters,
    }).getCount();
  },
};

export const MostActiveStudents: InsightObject = {
  displayName: 'Most Active Students',
  description:
    'Who are the students who have asked the most questions in Office Hours?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Table,
  size: 'default' as const,
  async compute(filters, cacheManager: Cache): Promise<TableOutputType> {
    const dataSource = await getCachedActiveStudents(cacheManager, filters);
    await addFilters({
      query: createQueryBuilder(UserCourseModel).where("role = 'student'"),
      modelName: UserCourseModel.name,
      allowedFilters: ['courseId', 'role'],
      filters,
    }).getCount();

    return {
      headerRow: ['Student Name', 'Email', 'Questions Asked'],
      data: dataSource.map((item) => {
        return {
          studentName: `${item.name} (${item.studentId})`,
          email: item.email,
          questionsAsked: item.questionsAsked,
        };
      }),
    };
  },
};

const getCachedActiveStudents = async (
  cacheManager: Cache,
  filters: Filter[],
): Promise<any[]> => {
  const courseId = filters.find((filter: Filter) => filter.type === 'courseId')[
    'courseId'
  ];
  const timeframe = filters.find(
    (filter: Filter) => filter.type === 'timeframe',
  );
  const getStartString = timeframe
    ? `${timeframe['start'].getDay()}-${timeframe[
        'start'
      ].getMonth()}-${timeframe['start'].getFullYear()}`
    : '';
  const getEndString = timeframe
    ? `${timeframe['start'].getDay()}-${timeframe[
        'start'
      ].getMonth()}-${timeframe['start'].getFullYear()}`
    : '';
  //One hour
  const cacheLengthInSeconds = 3600;
  return cacheManager.wrap(
    `questions/${courseId}/${getStartString}:${getEndString}`,
    () => getActiveStudents(filters),
    { ttl: cacheLengthInSeconds },
  );
};

const getActiveStudents = async (filters: Filter[]): Promise<any[]> => {
  const activeStudents = await addFilters({
    query: createQueryBuilder()
      .select('"QuestionModel"."creatorId"', 'studentId')
      .addSelect(
        'concat("UserModel"."firstName", \' \',"UserModel"."lastName")',
        'name',
      )
      .addSelect('"UserModel"."email"', 'email')
      .addSelect('COUNT(*)', 'questionsAsked')
      .from(QuestionModel, 'QuestionModel'),
    modelName: QuestionModel.name,
    allowedFilters: ['courseId', 'timeframe'],
    filters,
  })
    .innerJoin(
      UserModel,
      'UserModel',
      '"UserModel".id = "QuestionModel"."creatorId"',
    )
    .groupBy('"QuestionModel"."creatorId"')
    .addGroupBy('name')
    .addGroupBy('"UserModel".email')
    .orderBy('4', 'DESC')
    .getRawMany();
  return activeStudents;
};

export const QuestionTypeBreakdown: InsightObject = {
  displayName: 'Question Tag Breakdown',
  description:
    'What is the distribution of student-selected question-types on the question form?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Chart,
  size: 'default' as const,
  async compute(filters): Promise<ChartOutputType> {
    const questionInfo = await addFilters({
      query: createQueryBuilder(QuestionModel)
        .leftJoinAndSelect('QuestionModel.questionTypes', 'questionType')
        .select('questionType.name', 'questionTypeName')
        .addSelect('COUNT(QuestionModel.id)', 'totalQuestions')
        .andWhere('questionType.name IS NOT NULL'),
      modelName: QuestionModel.name,
      allowedFilters: ['courseId', 'timeframe'],
      filters,
    })
      .groupBy('questionType.name')
      .having('questionType.name IS NOT NULL')
      .getRawMany();

    const asyncQuestionInfo = await addFilters({
      query: createQueryBuilder(AsyncQuestionModel)
        .leftJoinAndSelect('AsyncQuestionModel.questionTypes', 'questionType')
        .select('questionType.name', 'questionTypeName')
        .addSelect('COUNT(AsyncQuestionModel.id)', 'totalQuestions')
        .andWhere('questionType.name IS NOT NULL'),
      modelName: AsyncQuestionModel.name,
      allowedFilters: ['courseId', 'timeframe'],
      filters,
    })
      .groupBy('questionType.name')
      .having('questionType.name IS NOT NULL')
      .getRawMany();

    const keys: string[] = [];

    const keyGrabber = (value: any) => {
      if (
        value['questionTypeName'] != undefined &&
        !keys.includes(value['questionTypeName'])
      ) {
        keys.push(value['questionTypeName']);
      }
    };
    questionInfo.forEach(keyGrabber);
    asyncQuestionInfo.forEach(keyGrabber);
    const data: StringMap<any>[] = keys.map((key) => {
      let qNum = questionInfo.find(
          (v) => v['questionTypeName'] == key,
        )?.totalQuestions,
        aNum = asyncQuestionInfo.find(
          (v) => v['questionTypeName'] == key,
        )?.totalQuestions;
      qNum = !isNaN(parseInt(qNum)) ? parseInt(qNum) : 0;
      aNum = !isNaN(parseInt(aNum)) ? parseInt(aNum) : 0;

      return {
        questionTypeName: key,
        totalQuestions: aNum + qNum,
      };
    });

    return {
      data,
      xKey: 'questionTypeName',
      yKeys: ['totalQuestions'],
      label: 'Total Questions',
    };
  },
};

export const MedianWaitTime: InsightObject = {
  displayName: 'Median Wait Time',
  description:
    'What is the median wait time for a student to get help in the queue?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Value,
  size: 'small' as const,
  async compute(filters): Promise<ValueOutputType> {
    const questions = await addFilters({
      query: createQueryBuilder(QuestionModel)
        .select()
        .where('QuestionModel.firstHelpedAt IS NOT NULL'),
      modelName: QuestionModel.name,
      allowedFilters: ['courseId', 'timeframe'],
      filters,
    }).getMany();

    if (questions.length === 0) {
      return `0 min`;
    }

    const waitTimes = questions.map(
      (question) =>
        Math.floor(
          (question.firstHelpedAt.getTime() - question.createdAt.getTime()) /
            1000,
        ) / 60,
    );

    return `${Math.floor(Math.round(median(waitTimes)))} min`;
  },
};

export const AverageWaitTimeByWeekDay: InsightObject = {
  displayName: 'Average Wait Time By Day',
  description:
    'The average wait time for synchronous help requests grouped by week day.',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Chart,
  size: 'default' as const,

  async compute(filters): Promise<ChartOutputType> {
    type WaitTimesByDay = {
      avgHelpTime: number;
      weekday: number;
    };

    const questions = await addFilters({
      query: createQueryBuilder(QuestionModel)
        .select(
          'AVG(COALESCE(EXTRACT(EPOCH FROM QuestionModel.firstHelpedAt), EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM QuestionModel.createdAt)))',
          'avgHelpTime',
        )
        .addSelect('EXTRACT(DOW FROM QuestionModel.createdAt)', 'weekday')
        .groupBy('weekday'),
      modelName: QuestionModel.name,
      allowedFilters: ['courseId', 'timeframe'],
      filters,
    }).getRawMany<WaitTimesByDay>();

    const data: StringMap<any>[] = questions.map((value) => {
      return {
        weekday: numToWeekday(value.weekday),
        Average_Wait_Time: (value.avgHelpTime / 60).toFixed(2),
      };
    });

    return {
      data,
      xKey: 'weekday',
      yKeys: ['Average_Wait_Time'],
      label: 'Weekday',
    };
  },
};

export const MedianHelpingTime: InsightObject = {
  displayName: 'Median Helping Time',
  description:
    'What is the median duration that a TA helps a student on a call?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Value,
  size: 'small' as const,

  async compute(filters): Promise<ValueOutputType> {
    const questions = await addFilters({
      query: createQueryBuilder(QuestionModel)
        .select()
        .where(
          'QuestionModel.helpedAt IS NOT NULL AND QuestionModel.closedAt IS NOT NULL',
        ),
      modelName: QuestionModel.name,
      allowedFilters: ['courseId', 'timeframe'],
      filters,
    }).getMany();

    if (questions.length === 0) {
      return `0 min`;
    }

    const helpTimes = questions.map(
      (question) =>
        Math.floor(
          (question.closedAt.getTime() - question.helpedAt.getTime()) / 1000,
        ) / 60,
    );

    return `${Math.round(median(helpTimes))} min`;
  },
};

const median = (numbers: number[]) => {
  const sorted = numbers.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
};

export const QuestionToStudentRatio: InsightObject = {
  displayName: 'Questions per Student',
  description: 'How many questions were asked per student?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Value,
  size: 'small' as const,
  async compute(filters): Promise<ValueOutputType> {
    const totalQuestions = await TotalQuestionsAsked.compute(filters);
    const totalStudents = await TotalStudents.compute(filters);
    return totalStudents !== 0
      ? ((totalQuestions as number) / (totalStudents as number)).toFixed(2)
      : '0 students';
  },
};

export const HelpSeekingOverTime: InsightObject = {
  displayName: 'Student Interactions Over Time',
  description: 'What help services have students been utilizing over time?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Chart,
  size: 'default' as const,
  async compute(filters): Promise<ChartOutputType> {
    type HelpSeekingDates = {
      totalQuestions: string;
      totalAsyncQuestions: string;
      totalChatbotInteractions: string;
      date: Date;
    };

    let extendedTimeframe = false;
    if (filters['timeframe']) {
      const start = Date.parse(filters['timeframe'].start),
        end = Date.parse(filters['timeframe'].end);
      if (start && end) {
        extendedTimeframe = (end - start) / 2629746000 > 3;
      }
    }

    const dateConverter = (model: string, attr: string) => {
      return extendedTimeframe
        ? `TO_CHAR("${model}"."${attr}", 'YYYY-MM')`
        : `"${model}"."${attr}"::DATE`;
    };

    const questionModelDate = dateConverter('QuestionModel', 'createdAt'),
      asyncQuestionModelDate = dateConverter('AsyncQuestionModel', 'createdAt'),
      interactionModelDate = dateConverter('InteractionModel', 'timestamp');

    const rawData = await addFilters({
      query: createQueryBuilder(QuestionModel)
        .select('COUNT(DISTINCT(QuestionModel.id))', 'totalQuestions')
        .addSelect(
          'COUNT(DISTINCT(AsyncQuestionModel.id))',
          'totalAsyncQuestions',
        )
        .addSelect(
          'COUNT(DISTINCT(InteractionModel.id))',
          'totalChatbotInteractions',
        )
        .addSelect(questionModelDate, 'date')
        .leftJoin(
          AsyncQuestionModel,
          'AsyncQuestionModel',
          questionModelDate + ' = ' + asyncQuestionModelDate,
        )
        .leftJoin(
          InteractionModel,
          'InteractionModel',
          questionModelDate + ' = ' + interactionModelDate,
        )
        .orderBy(questionModelDate, 'ASC')
        .groupBy(questionModelDate),
      modelName: QuestionModel.name,
      allowedFilters: ['courseId', 'timeframe'],
      filters,
    }).getRawMany<HelpSeekingDates>();

    const data: StringMap<any>[] = rawData.map((value) => {
      return {
        date: extendedTimeframe
          ? value.date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
            })
          : value.date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
        Questions: parseInt(value.totalQuestions),
        Async_Questions: parseInt(value.totalAsyncQuestions),
        Chatbot_Interactions: parseInt(value.totalChatbotInteractions),
      };
    });

    return {
      data,
      xKey: 'date',
      yKeys: ['Questions', 'Async_Questions', 'Chatbot_Interactions'],
      label: 'Date',
    };
  },
};

export const HumanVsChatbot: InsightObject = {
  displayName: 'Human vs. Chatbot Answers',
  description:
    'How many questions have a verified human answer, and how helpful are these answers?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Chart,
  size: 'default' as const,
  async compute(filters): Promise<ChartOutputType> {
    type HumanVsChatbotData = {
      answered: string;
      verified: string;
      totalScore: string;
      totalVotes: string;
    };

    const getVotesQuery = (qb: SelectQueryBuilder<any>) =>
      qb
        .from(AsyncQuestionVotesModel, 'asyncVotes')
        .select('SUM("asyncVotes"."vote")', 'score')
        .addSelect('COUNT("asyncVotes"."id")', 'votes')
        .addSelect('asyncVotes.questionId', 'id')
        .groupBy('asyncVotes.questionId');

    const humanData = await addFilters({
      query: createQueryBuilder(AsyncQuestionModel)
        .select('COUNT(AsyncQuestionModel.id)', 'answered')
        .addSelect(
          'COALESCE(SUM(CASE WHEN AsyncQuestionModel.verified = TRUE THEN 1 ELSE 0 END), 0)',
          'verified',
        )
        .leftJoin(
          getVotesQuery,
          'AsyncQuestionVotesModel',
          '"AsyncQuestionVotesModel"."id" = "AsyncQuestionModel"."id"',
        )
        .addSelect(
          'COALESCE(SUM("AsyncQuestionVotesModel"."score"), 0)',
          'totalScore',
        )
        .addSelect(
          'COALESCE(SUM("AsyncQuestionVotesModel"."votes"), 0)',
          'totalVotes',
        )
        .where('AsyncQuestionModel.answerText IS NOT NULL'),
      modelName: AsyncQuestionModel.name,
      allowedFilters: ['courseId', 'timeframe'],
      filters,
    }).getRawMany<HumanVsChatbotData>();

    const aiData = await addFilters({
      query: createQueryBuilder(AsyncQuestionModel)
        .select('COUNT(AsyncQuestionModel.id)', 'answered')
        .addSelect(
          'COALESCE(SUM(CASE WHEN AsyncQuestionModel.verified = TRUE THEN 1 ELSE 0 END), 0)',
          'verified',
        )
        .leftJoin(
          getVotesQuery,
          'AsyncQuestionVotesModel',
          '"AsyncQuestionVotesModel"."id" = "AsyncQuestionModel"."id"',
        )
        .addSelect(
          'COALESCE(SUM("AsyncQuestionVotesModel"."score"), 0)',
          'totalScore',
        )
        .addSelect(
          'COALESCE(SUM("AsyncQuestionVotesModel"."votes"), 0)',
          'totalVotes',
        )
        .where('AsyncQuestionModel.answerText IS NULL')
        .andWhere('AsyncQuestionModel.aiAnswerText IS NOT NULL'),
      modelName: AsyncQuestionModel.name,
      allowedFilters: ['courseId', 'timeframe'],
      filters,
    }).getRawMany<HumanVsChatbotData>();

    const mapData = (value: HumanVsChatbotData, type: string) => {
      return {
        type,
        Answered: value.answered,
        Verified: value.verified,
        Total_Score: value.totalScore,
        Total_Votes: value.totalVotes,
      };
    };
    const data = humanData
      .map((value) => mapData(value, 'Human'))
      .concat(aiData.map((value) => mapData(value, 'Chatbot')));

    return {
      data,
      xKey: 'type',
      yKeys: ['Answered', 'Verified'],
      label: 'Type',
    };
  },
};

export const INSIGHTS_MAP = {
  TotalStudents,
  TotalQuestionsAsked,
  MedianWaitTime,
  QuestionTypeBreakdown,
  MostActiveStudents,
  QuestionToStudentRatio,
  MedianHelpingTime,
  AverageWaitTimeByWeekDay,
  HelpSeekingOverTime,
  HumanVsChatbot,
};
