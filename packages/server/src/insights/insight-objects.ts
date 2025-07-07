import {
  ChartOutputType,
  GanttChartOutputType,
  InsightFilterOption,
  InsightObject,
  InsightType,
  MultipleGanttChartOutputType,
  numToWeekday,
  Role,
  StringMap,
  TableOutputType,
  ValueOutputType,
} from '@koh/common';
import { UserCourseModel } from '../profile/user-course.entity';
import { UserModel } from '../profile/user.entity';
import { QuestionModel } from '../question/question.entity';
import { SelectQueryBuilder } from 'typeorm';
import { Cache } from 'cache-manager';
import { AsyncQuestionModel } from '../asyncQuestion/asyncQuestion.entity';
import { InteractionModel } from '../chatbot/interaction.entity';
import { AsyncQuestionVotesModel } from '../asyncQuestion/asyncQuestionVotes.entity';
import { QuestionTypeModel } from '../questionType/question-type.entity';

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
    if (
      allowedFilters.includes(filter.type) &&
      APPLY_FILTER_MAP[modelName] != undefined &&
      APPLY_FILTER_MAP[modelName][filter.type] != undefined
    ) {
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
      query.andWhere('QuestionModel.creatorId IN (:...studentIds)', {
        studentIds: filter.studentIds,
      });
    },
    queues: ({ query, filter }: ApplyFilterParams) => {
      query.andWhere('QuestionModel.queueId IN (:...queueIds)', {
        queueIds: filter.queueIds,
      });
    },
    staff: ({ query, filter }: ApplyFilterParams) => {
      query.andWhere('QuestionModel.taHelpedId IN (:...staffIds)', {
        staffIds: filter.staffIds,
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
      query.andWhere('AsyncQuestionModel.creatorId IN (:...studentIds)', {
        studentIds: filter.studentIds,
      });
    },
    staff: ({ query, filter }: ApplyFilterParams) => {
      query.andWhere('AsyncQuestionModel.taHelpedId IN (:...staffIds)', {
        staffIds: filter.staffIds,
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
      query.andWhere('InteractionModel.user IN (:...studentIds)', {
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
    students: ({ query, filter }: ApplyFilterParams) => {
      query.andWhere('"userId" IN (:...studentIds)', {
        studentIds: filter.studentIds,
      });
    },
  },
};

function constructDateExtractString(
  extract: 'DOW' | 'EPOCH',
  modelName: string,
  attribute: string,
  map: 'DATE' | 'TIMESTAMP' = 'TIMESTAMP',
) {
  if (modelName == 'NOW()') {
    return `EXTRACT(${extract} FROM NOW())`;
  }
  return `EXTRACT(${extract} FROM "${modelName}"."${attribute}"::${map})`;
}

export const TotalStudents: InsightObject = {
  displayName: 'Total Students',
  description:
    'What is the total number of students that are enrolled in the course?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Value,
  insightCategory: 'Tool_Usage_Statistics',
  allowedFilters: ['courseId', 'timeframe'],
  async compute({ insightFilters }): Promise<ValueOutputType> {
    return await addFilters({
      query: UserCourseModel.createQueryBuilder().where("role = 'student'"),
      modelName: UserCourseModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getCount();
  },
};

export const TotalQuestionsAsked: InsightObject = {
  displayName: 'Total Questions',
  description: 'How many questions have been asked in total?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Value,
  insightCategory: 'Questions',
  allowedFilters: ['courseId', 'timeframe'],
  async compute({ insightFilters }): Promise<ValueOutputType> {
    return await addFilters({
      query: QuestionModel.createQueryBuilder().select(),
      modelName: QuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getCount();
  },
};

export const MostActiveStudents: InsightObject = {
  displayName: 'Most Active Students',
  description:
    'Who are the students who have asked the most questions in Office Hours?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Table,
  insightCategory: 'Tool_Usage_Statistics',
  allowedFilters: ['courseId', 'timeframe'],
  async compute({ insightFilters, cacheManager }): Promise<TableOutputType> {
    const dataSource = await getCachedActiveStudents(
      cacheManager,
      insightFilters,
      this.allowedFilters,
    );

    return {
      headerRow: ['Student Name', 'Questions Asked'],
      data: dataSource.map((item) => {
        return {
          studentName: `${item.name}`,
          questionsAsked: item.questionsAsked,
        };
      }),
    };
  },
};

const getCachedActiveStudents = async (
  cacheManager: Cache,
  filters: Filter[],
  allowedFilters?: InsightFilterOption[],
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
    () => getActiveStudents(filters, allowedFilters),
    cacheLengthInSeconds,
  );
};

const getActiveStudents = async (
  filters: Filter[],
  allowedFilters?: InsightFilterOption[],
): Promise<any[]> => {
  return await addFilters({
    query: QuestionModel.createQueryBuilder('QuestionModel')
      .select('"QuestionModel"."creatorId"', 'studentId')
      .addSelect('"UserModel"."name"', 'name')
      .addSelect('"UserModel"."email"', 'email')
      .addSelect('COUNT(*)', 'questionsAsked'),
    modelName: QuestionModel.name,
    allowedFilters: allowedFilters,
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
    .limit(5)
    .getRawMany();
};

export const QuestionTypeBreakdown: InsightObject = {
  displayName: 'Question Tag Breakdown',
  description:
    'What is the distribution of student-selected question-types on the question form?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Chart,
  insightCategory: 'Questions',
  allowedFilters: ['courseId', 'timeframe'],
  async compute({ insightFilters }): Promise<ChartOutputType> {
    const questionInfo = await addFilters({
      query: QuestionModel.createQueryBuilder()
        .withDeleted()
        .leftJoinAndSelect('QuestionModel.questionTypes', 'questionType')
        .select('questionType.name', 'questionTypeName')
        .addSelect('COUNT(QuestionModel.id)', 'totalQuestions')
        .andWhere('questionType.name IS NOT NULL'),
      modelName: QuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    })
      .groupBy('questionType.name')
      .having('questionType.name IS NOT NULL')
      .getRawMany();

    const asyncQuestionInfo = await addFilters({
      query: AsyncQuestionModel.createQueryBuilder()
        .withDeleted()
        .leftJoinAndSelect('AsyncQuestionModel.questionTypes', 'questionType')
        .select('questionType.name', 'questionTypeName')
        .addSelect('COUNT(AsyncQuestionModel.id)', 'totalQuestions')
        .andWhere('questionType.name IS NOT NULL'),
      modelName: AsyncQuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    })
      .groupBy('questionType.name')
      .having('questionType.name IS NOT NULL')
      .getRawMany();

    const keys: string[] = [];
    const fills: { [key: string]: string } = {};
    (
      await QuestionTypeModel.createQueryBuilder()
        .withDeleted()
        .select('QuestionTypeModel.name', 'name')
        .addSelect('QuestionTypeModel.color', 'fill')
        .where('QuestionTypeModel.cid = :courseId', {
          courseId: insightFilters.find((f: Filter) => f.type == 'courseId')
            ?.courseId,
        })
        .andWhere('QuestionTypeModel.name IS NOT NULL')
        .orderBy('QuestionTypeModel.deletedAt', 'ASC')
        .getRawMany<{ name: string; fill: string }>()
    ).forEach((v) => {
      if (!keys.includes(v.name)) {
        keys.push(v.name);
        fills[v.name] = v.fill == '#000000' ? undefined : v.fill;
      }
    });

    const data: StringMap<any>[] = keys
      .map((key) => {
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
          fill: fills[key],
        };
      })
      .filter((d) => d.totalQuestions > 0);

    return {
      data,
      xKey: 'questionTypeName',
      yKeys: ['totalQuestions'],
      label: 'Total Questions',
      xType: 'category',
    };
  },
};

export const MedianWaitTime: InsightObject = {
  displayName: 'Median Wait Time',
  description:
    'What is the median wait time for a student to get help in the queue?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Value,
  insightCategory: 'Tool_Usage_Statistics',
  allowedFilters: ['courseId', 'timeframe'],
  async compute({ insightFilters }): Promise<ValueOutputType> {
    const questions = await addFilters({
      query: QuestionModel.createQueryBuilder()
        .select()
        .where('QuestionModel.firstHelpedAt IS NOT NULL'),
      modelName: QuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getMany();

    if (questions.length === 0) {
      return `0 min`;
    }

    const waitTimes = questions.map((question) => question.waitTime / 60);

    return `${Math.floor(Math.round(median(waitTimes)))} min`;
  },
};

export const AverageTimesByWeekDay: InsightObject = {
  displayName: 'Average Times By Weekday',
  description:
    'The average time for synchronous help requests to be addressed, grouped by week day.',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Chart,
  insightCategory: 'Queues',
  allowedFilters: ['courseId', 'timeframe', 'queues'],
  async compute({ insightFilters }): Promise<ChartOutputType> {
    type WaitTimesByDay = {
      avgWaitTime: number;
      avgHelpTime: number;
      weekday: number;
    };

    const questions = await addFilters({
      query: QuestionModel.createQueryBuilder()
        .select(`AVG(QuestionModel.waitTime)`, 'avgWaitTime')
        .addSelect(`AVG(QuestionModel.helpTime)`, 'avgHelpTime')
        .addSelect(
          constructDateExtractString(
            'DOW',
            'QuestionModel',
            'createdAt',
            'DATE',
          ),
          'weekday',
        )
        .andWhere('QuestionModel.status IN (:...status)', {
          status: ['Resolved'],
        })
        .groupBy('weekday'),
      modelName: QuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getRawMany<WaitTimesByDay>();

    const data: StringMap<any>[] = questions
      .map((value) => {
        return {
          weekday: numToWeekday(value.weekday),
          weekdayN: parseInt('' + value.weekday),
          Average_Help_Time: (value.avgHelpTime / 60).toFixed(2),
          Average_Wait_Time: (value.avgWaitTime / 60).toFixed(2),
          Total_Time: (value.avgWaitTime / 60 + value.avgHelpTime / 60).toFixed(
            2,
          ),
        };
      })
      .sort((a, b) => a.weekdayN - b.weekdayN);

    return {
      data,
      xKey: 'weekday',
      yKeys: ['Average_Wait_Time', 'Average_Help_Time', 'Total_Time'],
      label: 'Weekday',
      xType: 'category',
    };
  },
};

export const MostActiveTimes: InsightObject = {
  displayName: 'Most Active Times',
  description:
    'The most in-demand queue times during the calendar week, based on the number of queued questions throughout the day.',
  roles: [Role.PROFESSOR],
  insightType: InsightType.GanttChart,
  insightCategory: 'Queues',
  allowedFilters: ['courseId', 'timeframe', 'queues'],
  async compute({ insightFilters }): Promise<GanttChartOutputType> {
    type ActiveTimes = {
      quarterTime: number;
      amount: number;
      weekday: number;
    };

    const extractMinutesIntoDay = `ROUND((${constructDateExtractString('EPOCH', 'QuestionModel', 'createdAt')} - ${constructDateExtractString('EPOCH', 'QuestionModel', 'createdAt', 'DATE')})/60)`;
    const getQuarterTimeString = `CEIL(${extractMinutesIntoDay}/15)*15`;

    const questions = await addFilters({
      query: QuestionModel.createQueryBuilder()
        .select(getQuarterTimeString, 'quarterTime')
        .addSelect('COUNT(QuestionModel.id)', 'amount')
        .addSelect(
          constructDateExtractString('DOW', 'QuestionModel', 'createdAt'),
          'weekday',
        )
        .andWhere('QuestionModel.createdAt IS NOT NULL')
        .groupBy(getQuarterTimeString)
        .addGroupBy(
          constructDateExtractString('DOW', 'QuestionModel', 'createdAt'),
        )
        .orderBy(getQuarterTimeString, 'ASC')
        .addOrderBy('weekday', 'ASC'),
      modelName: QuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getRawMany<ActiveTimes>();

    const data: StringMap<any>[] = questions
      .map((value) => {
        return {
          Weekday: parseInt(value.weekday + ''),
          Amount: parseInt(value.amount + ''),
          time: parseInt(value.quarterTime + ''),
        };
      })
      .sort((a, b) => a.Weekday - b.Weekday);

    return {
      data,
      xKey: 'time',
      yKey: 'Weekday',
      zKey: 'Amount',
      label: 'Weekday',
      numCategories: 7,
    };
  },
};

export const MedianHelpingTime: InsightObject = {
  displayName: 'Median Helping Time',
  description:
    'What is the median duration that a TA helps a student on a call?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Value,
  insightCategory: 'Queues',
  allowedFilters: ['courseId', 'timeframe'],
  async compute({ insightFilters }): Promise<ValueOutputType> {
    const questions = await addFilters({
      query: QuestionModel.createQueryBuilder()
        .select()
        .where(
          'QuestionModel.helpedAt IS NOT NULL AND QuestionModel.closedAt IS NOT NULL',
        ),
      modelName: QuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
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
  insightCategory: 'Tool_Usage_Statistics',
  allowedFilters: ['courseId', 'timeframe'],
  async compute(args): Promise<ValueOutputType> {
    const totalQuestions = await TotalQuestionsAsked.compute(args);
    const totalStudents = await TotalStudents.compute(args);
    return (
      (totalStudents !== 0
        ? ((totalQuestions as number) / (totalStudents as number)).toFixed(2)
        : '0') + ' Questions per Student'
    );
  },
};

type HelpSeekingDates = {
  totalQuestions: string;
  totalAsyncQuestions: string;
  totalChatbotInteractions: string;
  date: Date;
};

export const HelpSeekingOverTime: InsightObject = {
  displayName: 'Student Interactions Over Time',
  description: 'What help services have students been utilizing over time?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Chart,
  insightCategory: 'Tool_Usage_Statistics',
  allowedFilters: ['courseId', 'timeframe', 'queues', 'students'],
  async compute({ insightFilters, cacheManager }): Promise<ChartOutputType> {
    const timeframe = insightFilters.find(
      (filter: Filter) => filter.type == 'timeframe',
    );
    const startTime = timeframe ? new Date(timeframe['start']).getTime() : 0;
    const endTime = timeframe
      ? new Date(timeframe['end']).getTime()
      : new Date().getTime();

    const rawData = await getCachedHelpSeekingOverTime(
      cacheManager,
      insightFilters,
    );
    const data: StringMap<any>[] = rawData
      .map((value) => {
        return {
          date: new Date(value.date).getTime(),
          Questions: parseInt(value.totalQuestions),
          Async_Questions: parseInt(value.totalAsyncQuestions),
          Chatbot_Interactions: parseInt(value.totalChatbotInteractions),
        };
      })
      .filter((value) => value.date >= startTime && value.date <= endTime);

    if (data.length == 0) {
      return {
        data: [],
        xKey: 'date',
        yKeys: ['Questions', 'Async_Questions', 'Chatbot_Interactions'],
        label: 'date',
        xType: 'numeric',
      };
    }

    const oneDay = 1000 * 60 * 1440;
    const minDate = Math.min(...data.map((v) => v.date));
    const gaps: { start: number; end: number }[] = [];
    data.forEach((value, index) => {
      const next = data[index + 1];
      if (next != undefined) {
        const interval = next.date - value.date;
        if (interval > oneDay) {
          gaps.push({ start: value.date, end: next.date });
        }
      }
    });

    gaps.forEach((v) => {
      for (let i = v.start + oneDay; i < v.end; i += oneDay) {
        data.push({
          date: i,
          Questions: 0,
          Async_Questions: 0,
          Chatbot_Interactions: 0,
        });
      }
    });

    const interval = minDate - startTime;
    if (minDate > startTime && startTime > 0 && interval > 0) {
      const modifier = interval > oneDay * 31 ? oneDay * 31 : oneDay;
      for (let i = startTime; i < minDate; i += modifier) {
        data.push({
          date: i,
          Questions: 0,
          Async_Questions: 0,
          Chatbot_Interactions: 0,
        });
      }
    }
    data.sort((a, b) => a.date - b.date);

    return {
      data,
      xKey: 'date',
      yKeys: ['Questions', 'Async_Questions', 'Chatbot_Interactions'],
      label: 'date',
      xType: 'numeric',
    };
  },
};

const getCachedHelpSeekingOverTime = async (
  cacheManager: Cache,
  filters: Filter[],
): Promise<HelpSeekingDates[]> => {
  const courseId = filters.find((filter: Filter) => filter.type === 'courseId')[
    'courseId'
  ];

  const queuesFilter = filters.find(
    (filter: Filter) => filter.type === 'queues',
  );
  let queues: string | undefined;
  if (queuesFilter != undefined) {
    queues = queuesFilter['queueIds'].toString();
  }

  const studentFilter = filters.find(
    (filter: Filter) => filter.type === 'students',
  );
  let students: string | undefined;
  if (studentFilter != undefined) {
    students = studentFilter['studentIds'].toString();
  }

  // 5 minutes
  const cacheLengthInSeconds = 300;
  return cacheManager.wrap(
    `help-seeking/${courseId}${queues != undefined ? '/' + queues : ''}${students != undefined ? '/' + students : ''}`,
    () => getHelpSeekingOverTime(filters),
    cacheLengthInSeconds,
  );
};

const getHelpSeekingOverTime = async (
  filters: Filter[],
): Promise<HelpSeekingDates[]> => {
  const dateConverter = (model: string, attr: string) => {
    return `"${model}"."${attr}"::DATE`;
  };

  const questionModelDate = dateConverter('QuestionModel', 'createdAt'),
    asyncQuestionModelDate = dateConverter('AsyncQuestionModel', 'createdAt'),
    interactionModelDate = dateConverter('InteractionModel', 'timestamp');

  return await addFilters({
    query: QuestionModel.createQueryBuilder()
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
    allowedFilters: ['courseId', 'students', 'queues'],
    filters,
  }).getRawMany<HelpSeekingDates>();
};

export const HumanVsChatbot: InsightObject = {
  displayName: 'Human vs. Chatbot Answers',
  description:
    'How many questions have a verified and/or human answer, and how many only have a chatbot answer?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Chart,
  insightCategory: 'Chatbot',
  allowedFilters: ['courseId', 'timeframe'],
  async compute({ insightFilters }): Promise<ChartOutputType> {
    type HumanVsChatbotData = {
      answered: string;
      verified: string;
    };

    const humanData = await addFilters({
      query: AsyncQuestionModel.createQueryBuilder()
        .select('COUNT(AsyncQuestionModel.id)', 'answered')
        .addSelect(
          'COALESCE(SUM(CASE WHEN AsyncQuestionModel.verified = TRUE THEN 1 ELSE 0 END), 0)',
          'verified',
        )
        .where('AsyncQuestionModel.status in (:...statuses)', {
          statuses: ['HumanAnswered'],
        }),
      modelName: AsyncQuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getRawMany<HumanVsChatbotData>();

    const aiData = await addFilters({
      query: AsyncQuestionModel.createQueryBuilder()
        .select('COUNT(AsyncQuestionModel.id)', 'answered')
        .addSelect(
          'COALESCE(SUM(CASE WHEN AsyncQuestionModel.verified = TRUE THEN 1 ELSE 0 END), 0)',
          'verified',
        )
        .where('AsyncQuestionModel.status in (:...statuses)', {
          statuses: [
            'AIAnsweredResolved',
            'AIAnswered',
            'AIAnsweredNeedsAttention',
          ],
        }),
      modelName: AsyncQuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getRawMany<HumanVsChatbotData>();

    const mapData = (value: HumanVsChatbotData, type: string) => {
      return {
        type,
        Answered: parseInt(value.answered),
        Verified: parseInt(value.verified),
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
      xType: 'category',
    };
  },
};

export const HumanVsChatbotVotes: InsightObject = {
  displayName: 'Human vs. Chatbot Votes',
  description: 'How helpful are human answers, versus chatbot answers?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Chart,
  insightCategory: 'Chatbot',
  allowedFilters: ['courseId', 'timeframe'],
  async compute({ insightFilters }): Promise<ChartOutputType> {
    type HumanVsChatbotData = {
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
      query: AsyncQuestionModel.createQueryBuilder()
        .select('COUNT(AsyncQuestionModel.id)', 'answered')
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
        .where('AsyncQuestionModel.status in (:...statuses)', {
          statuses: ['HumanAnswered'],
        }),
      modelName: AsyncQuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getRawMany<HumanVsChatbotData>();

    const aiData = await addFilters({
      query: AsyncQuestionModel.createQueryBuilder()
        .select('COUNT(AsyncQuestionModel.id)', 'answered')
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
        .where('AsyncQuestionModel.status in (:...statuses)', {
          statuses: [
            'AIAnsweredResolved',
            'AIAnswered',
            'AIAnsweredNeedsAttention',
          ],
        }),
      modelName: AsyncQuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getRawMany<HumanVsChatbotData>();

    const mapData = (value: HumanVsChatbotData, type: string) => {
      return {
        type,
        Total_Score: parseInt(value.totalScore),
        Total_Votes: parseInt(value.totalVotes),
      };
    };
    const data = humanData
      .map((value) => mapData(value, 'Human'))
      .concat(aiData.map((value) => mapData(value, 'Chatbot')));

    return {
      data,
      xKey: 'type',
      yKeys: ['Total_Score', 'Total_Votes'],
      label: 'Type',
      xType: 'category',
    };
  },
};

export const StaffWorkload: InsightObject = {
  displayName: 'Staff Workload',
  description: 'How many questions on average do staff members help in a day?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.MultipleGanttChart,
  insightCategory: 'Staff',
  allowedFilters: ['courseId', 'timeframe', 'queues', 'staff'],
  async compute({ insightFilters }): Promise<MultipleGanttChartOutputType> {
    type HelpedQuestions = {
      quarterTime: number;
      staffMember: number;
      amount: number;
      weekday: number;
    };

    const extractMinutesIntoDay = `ROUND((${constructDateExtractString('EPOCH', 'QuestionModel', 'createdAt')} - ${constructDateExtractString('EPOCH', 'QuestionModel', 'createdAt', 'DATE')})/60)`;
    const extractWeekday = constructDateExtractString(
      'DOW',
      'QuestionModel',
      'createdAt',
    );
    const getQuarterTimeString = `CEIL(${extractMinutesIntoDay}/15)*15`;

    const taQuestions = await addFilters({
      query: QuestionModel.createQueryBuilder()
        .select(getQuarterTimeString, 'quarterTime')
        .addSelect('QuestionModel.taHelpedId', 'staffMember')
        .addSelect('COUNT(QuestionModel.id)', 'amount')
        .addSelect(extractWeekday, 'weekday')
        .where('QuestionModel.taHelpedId IS NOT NULL')
        .andWhere('QuestionModel.createdAt IS NOT NULL')
        .groupBy(getQuarterTimeString)
        .addGroupBy('QuestionModel.taHelpedId')
        .addGroupBy(extractWeekday)
        .orderBy(getQuarterTimeString, 'ASC')
        .addOrderBy('weekday', 'ASC'),
      modelName: QuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getRawMany<HelpedQuestions>();

    const ids = taQuestions
      .map((value) => value.staffMember)
      .filter((v, i, a) => a.indexOf(v) == i);
    if (ids.length == 0) {
      return [];
    }

    const staffNames: { id: number; name: string }[] =
      await UserModel.createQueryBuilder()
        .select('UserModel.id', 'id')
        .addSelect('UserModel.name', 'name')
        .where('UserModel.id IN (:...ids)', { ids })
        .getRawMany<{ id: number; name: string }>();

    const outputs: GanttChartOutputType[] = [];
    for (let i = 0; i < 7; i++) {
      const dayQuestions = taQuestions.filter((q) => q.weekday == i);
      if (dayQuestions.length == 0) continue;
      const uniqueStaff: number[] = dayQuestions
        .map((q) => q.staffMember)
        .filter((v, i, a) => a.indexOf(v) == i);
      outputs.push({
        data: dayQuestions.map((q) => {
          return {
            Amount: parseInt(q.amount + ''),
            time: parseInt(q.quarterTime + ''),
            Staff_Member:
              staffNames.find((s) => s.id == q.staffMember)?.name ??
              `ID ${q.staffMember}`,
          };
        }),
        xKey: 'time',
        yKey: 'Staff_Member',
        zKey: 'Amount',
        label: numToWeekday(i),
        numCategories: uniqueStaff.length,
      });
    }
    return outputs;
  },
};

export const StaffEfficiency: InsightObject = {
  displayName: 'Staff Efficiency',
  description: 'How efficient are staff in helping questions?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Chart,
  insightCategory: 'Staff',
  allowedFilters: ['courseId', 'timeframe', 'queues', 'staff'],
  async compute({ insightFilters }): Promise<ChartOutputType> {
    type WaitTimesByTA = {
      avgWaitTime: number;
      avgHelpTime: number;
      staffMember: number;
    };

    const questions = await addFilters({
      query: QuestionModel.createQueryBuilder()
        .select(`AVG(QuestionModel.waitTime)`, 'avgWaitTime')
        .addSelect(`AVG(QuestionModel.helpTime)`, 'avgHelpTime')
        .addSelect('QuestionModel.taHelpedId', 'staffMember')
        .where('QuestionModel.taHelpedId IS NOT NULL')
        .andWhere('QuestionModel.status IN (:...status)', {
          status: ['Resolved'],
        })
        .groupBy('QuestionModel.taHelpedId'),
      modelName: QuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getRawMany<WaitTimesByTA>();

    const ids = questions.map((value) => value.staffMember);
    if (ids.length == 0) {
      return {
        data: [],
        xKey: 'staffMember',
        yKeys: ['Average_Wait_Time', 'Average_Help_Time', 'Total_Time'],
        label: 'Weekday',
        xType: 'category',
      };
    }

    const staffNames: { id: number; name: string }[] =
      await UserModel.createQueryBuilder()
        .select('UserModel.id', 'id')
        .addSelect("UserModel.firstName || ' ' || UserModel.lastName", 'name')
        .where('UserModel.id IN (:...ids)', { ids })
        .getRawMany<{ id: number; name: string }>();

    const data: StringMap<any>[] = questions.map((value) => {
      return {
        staffMember:
          staffNames.find((s) => s.id == value.staffMember)?.name ??
          `ID ${value.staffMember}`,
        Average_Help_Time: (value.avgHelpTime / 60).toFixed(2),
        Average_Wait_Time: (value.avgWaitTime / 60).toFixed(2),
        Total_Time: (value.avgWaitTime / 60 + value.avgHelpTime / 60).toFixed(
          2,
        ),
      };
    });

    return {
      data,
      xKey: 'staffMember',
      yKeys: ['Average_Wait_Time', 'Average_Help_Time', 'Total_Time'],
      label: 'Staff Member',
      xType: 'category',
    };
  },
};

export const StaffTotalHelped: InsightObject = {
  displayName: 'Staff Helpfulness',
  description: 'How many questions has each staff member helped?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Chart,
  insightCategory: 'Staff',
  allowedFilters: ['courseId', 'timeframe', 'staff'],
  async compute({ insightFilters }): Promise<ChartOutputType> {
    const questions = await addFilters({
      query: QuestionModel.createQueryBuilder()
        .select('COUNT(QuestionModel.id)', 'questionsHelped')
        .leftJoin(
          (qb: SelectQueryBuilder<any>) =>
            qb
              .from(AsyncQuestionModel, 'asyncModel')
              .select('asyncModel.id', 'id')
              .addSelect('asyncModel.taHelpedId', 'taHelpedId')
              .where('asyncModel.status IN (:...status)', {
                status: ['HumanAnswered'],
              }),
          'AsyncQuestionModel',
          '"QuestionModel"."taHelpedId" = "AsyncQuestionModel"."taHelpedId"',
        )
        .addSelect('COUNT("AsyncQuestionModel"."id")', 'asyncHelped')
        .addSelect('QuestionModel.taHelpedId', 'staffMember')
        .where('QuestionModel.taHelpedId IS NOT NULL')
        .andWhere('QuestionModel.status IN (:...status)', {
          status: ['Resolved'],
        })
        .groupBy('QuestionModel.taHelpedId'),
      modelName: QuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getRawMany<{
      staffMember: number;
      questionsHelped: number;
      asyncHelped: number;
    }>();

    const asyncQuestions = await addFilters({
      query: AsyncQuestionModel.createQueryBuilder()
        .select('COUNT(AsyncQuestionModel.id)', 'questionsHelped')
        .addSelect('AsyncQuestionModel.taHelpedId', 'staffMember')
        .where('AsyncQuestionModel.taHelpedId IS NOT NULL')
        .andWhere('AsyncQuestionModel.status IN (:...status)', {
          status: ['HumanAnswered'],
        })
        .groupBy('AsyncQuestionModel.taHelpedId'),
      modelName: AsyncQuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getRawMany<{
      staffMember: number;
      questionsHelped: number;
      asyncHelped: number;
    }>();

    const ids = [...questions, ...asyncQuestions]
      .map((q) => q.staffMember)
      .filter((v, i, a) => a.indexOf(v) == i);
    if (ids.length == 0) {
      return {
        data: [],
        xKey: 'staffMember',
        yKeys: ['Questions_Helped', 'Async_Questions_Helped', 'Total_Helped'],
        label: 'Staff Member',
        xType: 'category',
      };
    }

    const merged: {
      staffMember: number;
      questionsHelped: number;
      asyncQuestionsHelped: number;
    }[] = questions.map((q) => {
      return {
        staffMember: q.staffMember,
        questionsHelped: q.questionsHelped,
        asyncQuestionsHelped: 0,
      };
    });
    asyncQuestions.forEach((aq) => {
      const match = merged.find((q) => q.staffMember == aq.staffMember);
      if (match) {
        match.asyncQuestionsHelped = aq.questionsHelped;
      } else {
        merged.push({
          staffMember: aq.staffMember,
          questionsHelped: 0,
          asyncQuestionsHelped: aq.questionsHelped,
        });
      }
    });

    const staffNames: { id: number; name: string }[] =
      await UserModel.createQueryBuilder()
        .select('UserModel.id', 'id')
        .addSelect("UserModel.firstName || ' ' || UserModel.lastName", 'name')
        .where('UserModel.id IN (:...ids)', { ids })
        .getRawMany<{ id: number; name: string }>();

    return {
      data: merged.map((q) => {
        return {
          staffMember:
            staffNames.find((s) => s.id == q.staffMember)?.name ??
            `ID ${q.staffMember}`,
          Questions_Helped: q.questionsHelped,
          Async_Questions_Helped: q.asyncQuestionsHelped,
          Total_Helped:
            parseInt('' + q.asyncQuestionsHelped) +
            parseInt('' + q.questionsHelped),
        };
      }),
      xKey: 'staffMember',
      yKeys: ['Questions_Helped', 'Async_Questions_Helped', 'Total_Helped'],
      label: 'Staff Member',
      xType: 'category',
    };
  },
};

export const StaffQuestionTimesByDay: InsightObject = {
  displayName: 'Staff Question Times By Day',
  description:
    'How long do questions take, from start to finish, on different days by different staff?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.MultipleGanttChart,
  insightCategory: 'Staff',
  allowedFilters: ['courseId', 'timeframe', 'queues', 'staff'],
  async compute({ insightFilters }): Promise<MultipleGanttChartOutputType> {
    type HelpedQuestions = {
      quarterTime: number;
      staffMember: number;
      avgQuestionTime: number;
      weekday: number;
    };

    const extractMinutesIntoDay = `ROUND((${constructDateExtractString('EPOCH', 'QuestionModel', 'createdAt')} - ${constructDateExtractString('EPOCH', 'QuestionModel', 'createdAt', 'DATE')})/60)`;
    const extractWeekday = constructDateExtractString(
      'DOW',
      'QuestionModel',
      'createdAt',
    );

    const getQuarterTimeString = `CEIL(${extractMinutesIntoDay}/15)*15`;

    const taQuestions = await addFilters({
      query: QuestionModel.createQueryBuilder()
        .select(getQuarterTimeString, 'quarterTime')
        .addSelect('QuestionModel.taHelpedId', 'staffMember')
        .addSelect(
          `AVG(QuestionModel.waitTime + QuestionModel.helpTime)`,
          'avgQuestionTime',
        )
        .addSelect(extractWeekday, 'weekday')
        .where('QuestionModel.taHelpedId IS NOT NULL')
        .andWhere('QuestionModel.createdAt IS NOT NULL')
        .andWhere('QuestionModel.closedAt IS NOT NULL')
        .andWhere('QuestionModel.status IN (:...statuses)', {
          statuses: ['Resolved'],
        })
        .groupBy(getQuarterTimeString)
        .addGroupBy('QuestionModel.taHelpedId')
        .addGroupBy(extractWeekday)
        .orderBy(getQuarterTimeString, 'ASC')
        .addOrderBy('weekday', 'ASC'),
      modelName: QuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getRawMany<HelpedQuestions>();

    const ids = taQuestions
      .map((value) => value.staffMember)
      .filter((v, i, a) => a.indexOf(v) == i);
    if (ids.length == 0) {
      return [];
    }

    const staffNames: { id: number; name: string }[] =
      await UserModel.createQueryBuilder()
        .select('UserModel.id', 'id')
        .addSelect("UserModel.firstName || ' ' || UserModel.lastName", 'name')
        .where('UserModel.id IN (:...ids)', { ids })
        .getRawMany<{ id: number; name: string }>();

    const outputs: GanttChartOutputType[] = [];
    for (let i = 0; i < 7; i++) {
      const dayQuestions = taQuestions.filter((q) => q.weekday == i);
      if (dayQuestions.length == 0) continue;
      const uniqueStaff: number[] = dayQuestions
        .map((q) => q.staffMember)
        .filter((v, i, a) => a.indexOf(v) == i);
      outputs.push({
        data: dayQuestions.map((q) => {
          return {
            Average_Question_Time: (
              parseInt(q.avgQuestionTime + '') / 60
            ).toFixed(2),
            time: parseInt(q.quarterTime + ''),
            Staff_Member:
              staffNames.find((s) => s.id == q.staffMember)?.name ??
              `ID ${q.staffMember}`,
          };
        }),
        xKey: 'time',
        yKey: 'Staff_Member',
        zKey: 'Average_Question_Time',
        label: numToWeekday(i),
        numCategories: uniqueStaff.length,
      });
    }
    return outputs;
  },
};

export const QuestionTypesOverTime: InsightObject = {
  displayName: 'Question Types Over Time',
  description: 'How often are different types of questions asked?',
  roles: [Role.PROFESSOR],
  insightType: InsightType.Chart,
  insightCategory: 'Questions',
  allowedFilters: ['courseId', 'timeframe', 'queues'],
  async compute({ insightFilters }): Promise<ChartOutputType> {
    type questionTypeDated = {
      questionId: number;
      date: number;
      questionType_name: string;
      questionType_color: string;
    };

    const questionsAll = await addFilters({
      query: QuestionModel.createQueryBuilder()
        .select('QuestionModel.id', 'questionId')
        .withDeleted()
        .leftJoinAndSelect('QuestionModel.questionTypes', 'questionType')
        .addSelect('"QuestionModel"."createdAt"::DATE', 'date')
        .orderBy('"QuestionModel"."createdAt"::DATE', 'ASC'),
      modelName: QuestionModel.name,
      allowedFilters: this.allowedFilters,
      filters: insightFilters,
    }).getRawMany<questionTypeDated>();

    questionsAll.forEach((q) => (q.date = new Date(q.date).getTime()));

    const types: StringMap<string> = {};
    questionsAll
      .map((q) => ({ name: q.questionType_name, fill: q.questionType_color }))
      .filter((v, i, a) => a.indexOf(v) == i && v.name != null)
      .forEach((v) => (types[v.name.replace(/\s/g, '_')] = v.fill));

    const data: StringMap<any> = questionsAll
      .map((q) => q.date)
      .filter((v, i, a) => a.indexOf(v) == i)
      .map((day) => {
        const element: StringMap<any> = { date: day };
        const questions = questionsAll.filter((q) => q.date == day);
        Object.keys(types).forEach((type) => {
          element[type] = questions.filter(
            (q) => q.questionType_name == type,
          ).length;
        });
        return element;
      });

    return {
      data,
      xKey: 'date',
      yKeys: Object.keys(types),
      label: 'date',
      xType: 'numeric',
      yType: 'numeric',
      yFills: types,
    } as ChartOutputType;
  },
};

export const INSIGHTS_MAP = {
  TotalStudents,
  TotalQuestionsAsked,
  MedianWaitTime,
  QuestionTypeBreakdown,
  QuestionTypesOverTime,
  MostActiveStudents,
  QuestionToStudentRatio,
  MedianHelpingTime,
  AverageTimesByWeekDay,
  HumanVsChatbot,
  HumanVsChatbotVotes,
  MostActiveTimes,
  HelpSeekingOverTime,
  StaffEfficiency,
  StaffTotalHelped,
  StaffQuestionTimesByDay,
  StaffWorkload,
};
