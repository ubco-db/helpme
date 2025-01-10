import {
  ClosedQuestionStatus,
  LimboQuestionStatus,
  OpenQuestionStatus,
  QuestionStatus,
  Role,
} from '@koh/common';

interface AllowableTransitions {
  student?: QuestionStatus[];
  ta?: QuestionStatus[];
}

const QUEUE_TRANSITIONS: AllowableTransitions = {
  ta: [OpenQuestionStatus.Helping, LimboQuestionStatus.TADeleted],
  student: [
    ClosedQuestionStatus.ConfirmedDeleted,
    ClosedQuestionStatus.LeftDueToNoStaff,
    ClosedQuestionStatus.Stale,
  ],
};

const HELPING_TRANSITIONS: AllowableTransitions = {
  ta: [
    LimboQuestionStatus.CantFind,
    LimboQuestionStatus.ReQueueing,
    ClosedQuestionStatus.Resolved,
    OpenQuestionStatus.Paused,
    LimboQuestionStatus.TADeleted,
  ],
  student: [
    ClosedQuestionStatus.ConfirmedDeleted,
    LimboQuestionStatus.ReQueueing,
    ClosedQuestionStatus.LeftDueToNoStaff,
    ClosedQuestionStatus.Stale,
  ],
};

export const QUESTION_STATES: Record<QuestionStatus, AllowableTransitions> = {
  [OpenQuestionStatus.Drafting]: {
    student: [
      OpenQuestionStatus.Queued,
      ClosedQuestionStatus.ConfirmedDeleted,
      ClosedQuestionStatus.LeftDueToNoStaff,
      ClosedQuestionStatus.Stale,
    ],
    ta: [OpenQuestionStatus.Helping, ClosedQuestionStatus.DeletedDraft],
  },
  [OpenQuestionStatus.Queued]: QUEUE_TRANSITIONS,
  [OpenQuestionStatus.PriorityQueued]: QUEUE_TRANSITIONS,
  [OpenQuestionStatus.Paused]: {
    ta: [
      ...HELPING_TRANSITIONS.ta.filter((t) => t != OpenQuestionStatus.Paused),
      OpenQuestionStatus.Helping,
    ],
    student: HELPING_TRANSITIONS.student,
  },
  [OpenQuestionStatus.Helping]: HELPING_TRANSITIONS,
  [LimboQuestionStatus.CantFind]: {
    student: [
      OpenQuestionStatus.PriorityQueued,
      OpenQuestionStatus.Queued,
      ClosedQuestionStatus.ConfirmedDeleted,
      ClosedQuestionStatus.LeftDueToNoStaff,
      ClosedQuestionStatus.Stale,
    ],
  },
  [LimboQuestionStatus.ReQueueing]: {
    student: [
      OpenQuestionStatus.PriorityQueued,
      OpenQuestionStatus.Queued,
      ClosedQuestionStatus.ConfirmedDeleted,
      ClosedQuestionStatus.LeftDueToNoStaff,
      ClosedQuestionStatus.Stale,
    ],
  },
  [LimboQuestionStatus.TADeleted]: {
    student: [
      ClosedQuestionStatus.ConfirmedDeleted,
      ClosedQuestionStatus.LeftDueToNoStaff,
      ClosedQuestionStatus.Stale,
    ],
  },
  [ClosedQuestionStatus.Resolved]: {},
  [ClosedQuestionStatus.ConfirmedDeleted]: {},
  [ClosedQuestionStatus.Stale]: {},
  [ClosedQuestionStatus.DeletedDraft]: {},
  [ClosedQuestionStatus.LeftDueToNoStaff]: {},
};

export function canChangeQuestionStatus(
  oldStatus: QuestionStatus,
  goalStatus: QuestionStatus,
  role: Role,
): boolean {
  return (
    oldStatus === goalStatus ||
    QUESTION_STATES[oldStatus][role]?.includes(goalStatus)
  );
}
