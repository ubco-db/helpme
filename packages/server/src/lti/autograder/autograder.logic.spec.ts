import { AutograderQuestionStatus, BLANK_ANSWER_COMMENT } from '@koh/common';
import { classifyDiscoveredAnswer } from './autograder.logic';
import {
  MISSING_ANSWER_ERROR,
  UNREADABLE_ATTEMPT_ERROR,
} from './autograder.messages';

const answer = {
  questionId: 11,
  text: 'A real answer.',
  points: null,
  comment: null,
};

describe('classifyDiscoveredAnswer', () => {
  it('distinguishes unreadable and missing answers from blanks', () => {
    expect(classifyDiscoveredAnswer(undefined, false, false)).toEqual({
      status: AutograderQuestionStatus.Error,
      score: null,
      comment: null,
      reasons: [],
      error: UNREADABLE_ATTEMPT_ERROR,
    });
    expect(classifyDiscoveredAnswer(undefined, true, false)).toEqual({
      status: AutograderQuestionStatus.Error,
      score: null,
      comment: null,
      reasons: [],
      error: MISSING_ANSWER_ERROR,
    });
    expect(
      classifyDiscoveredAnswer({ ...answer, text: '  \n\t' }, true, false),
    ).toEqual({
      status: AutograderQuestionStatus.Graded,
      score: 0,
      comment: BLANK_ANSWER_COMMENT,
      reasons: ['blank'],
      error: null,
    });
  });

  it('skips existing grades unless the run is regrading', () => {
    for (const existing of [
      { ...answer, points: 2 },
      { ...answer, comment: 'Already reviewed.' },
    ]) {
      expect(classifyDiscoveredAnswer(existing, true, false).status).toBe(
        AutograderQuestionStatus.Skipped,
      );
      expect(classifyDiscoveredAnswer(existing, true, true).status).toBe(
        AutograderQuestionStatus.Pending,
      );
    }
  });

  it('leaves a fresh answer pending', () => {
    expect(classifyDiscoveredAnswer(answer, true, false)).toEqual({
      status: AutograderQuestionStatus.Pending,
      score: null,
      comment: null,
      reasons: [],
      error: null,
    });
  });
});
