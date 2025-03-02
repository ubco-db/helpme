export type ExpandedState =
  | 'collapsed'
  | 'expandedNoComments'
  | 'expandedWithComments'
  | 'expandedWithCommentsLocked'

export type UIState = {
  expandedState: ExpandedState
  truncateText: boolean
  isPostingComment: boolean
}

export type Action =
  | { type: 'EXPAND_QUESTION' } // collapsed -> expandedNoComments
  | { type: 'COLLAPSE_QUESTION' } // expandedNoComments -> collapsed
  | { type: 'SHOW_COMMENTS'; numOfComments: number } // collapsed OR expandedNoComments -> expandedWithComments
  | { type: 'HIDE_COMMENTS' } // expandedWithCommentsLocked OR expandedWithComments -> expandedNoComments
  | { type: 'LOCK_EXPANDED' } // expandedWithComments -> expandedWithCommentsLocked
  | { type: 'UNLOCK_EXPANDED' } // expandedWithCommentsLocked -> expandedWithComments
  | { type: 'TRUNCATE_TEXT' }
  | { type: 'SET_IS_POSTING_COMMENT'; isPostingComment: boolean }

export const initialUIState: UIState = {
  expandedState: 'collapsed',
  truncateText: true,
  isPostingComment: false,
}

/* This is a reducer that allows us to group together all the logic for changing the UI state of a question card.
    This also allows us to define all possible "actions" that we can perform on a question card in one place.
    Want to know more about useReducer? See https://react.dev/learn/extracting-state-logic-into-a-reducer and https://react.dev/learn/typescript#typing-usereducer
*/
export function AsyncQuestionCardUIReducer(
  state: UIState,
  action: Action,
): UIState {
  switch (action.type) {
    case 'EXPAND_QUESTION': {
      // can only go from collapsed to expandedNoComments
      if (state.expandedState === 'collapsed') {
        return {
          ...state,
          expandedState: 'expandedNoComments',
          truncateText: false, // when expanding, remove truncation instantly
        }
      } else {
        return state
      }
    }
    case 'COLLAPSE_QUESTION': {
      // DON'T FORGET TO TRUNCATE TEXT
      // can only go from expandedNoComments to collapsed
      if (state.expandedState === 'expandedNoComments') {
        // note that ideally you would truncate the text here after a 0.3s timeout, but you can't do that inside a reducer since they need to be pure and instant
        return { ...state, expandedState: 'collapsed' }
      } else {
        return state
      }
    }
    case 'SHOW_COMMENTS': {
      // can only go from collapsed or expandedNoComments to expandedWithComments
      if (
        state.expandedState === 'collapsed' ||
        state.expandedState === 'expandedNoComments'
      ) {
        // if there are no comments, set isPostingComment to true and lock the expanded state
        if (action.numOfComments === 0) {
          return {
            ...state,
            expandedState: 'expandedWithCommentsLocked',
            isPostingComment: true,
          }
        } else {
          return {
            ...state,
            expandedState: 'expandedWithComments',
          }
        }
      } else {
        return state
      }
    }
    case 'HIDE_COMMENTS': {
      // can only go from expandedWithCommentsLocked or expandedWithComments to expandedNoComments
      if (
        state.expandedState === 'expandedWithCommentsLocked' ||
        state.expandedState === 'expandedWithComments'
      ) {
        return { ...state, expandedState: 'expandedNoComments' }
      } else {
        return state
      }
    }
    case 'LOCK_EXPANDED': {
      // can only go from expandedWithComments to expandedWithCommentsLocked
      if (state.expandedState === 'expandedWithComments') {
        return { ...state, expandedState: 'expandedWithCommentsLocked' }
      } else {
        return state
      }
    }
    case 'UNLOCK_EXPANDED': {
      // can only go from expandedWithCommentsLocked to expandedWithComments
      if (state.expandedState === 'expandedWithCommentsLocked') {
        return { ...state, expandedState: 'expandedWithComments' }
      } else {
        return state
      }
    }
    case 'TRUNCATE_TEXT': {
      return { ...state, truncateText: true }
    }
    case 'SET_IS_POSTING_COMMENT': {
      return { ...state, isPostingComment: action.isPostingComment }
    }
    default: {
      console.error(
        'Invalid action type used inside AsyncQuestionCardUIReducer',
      )
      return state
    }
  }
}
