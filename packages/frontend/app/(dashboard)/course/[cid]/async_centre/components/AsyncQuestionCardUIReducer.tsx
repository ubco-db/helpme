export type ExpandedState =
  | 'collapsed'
  | 'expandedNoComments'
  | 'expandedWithComments'
  | 'expandedWithCommentsLocked'

export type UIState = {
  expandedState: ExpandedState
  truncateText: boolean
}

export type Action =
  | { type: 'EXPAND_QUESTION' } // collapsed -> expandedNoComments
  | { type: 'COLLAPSE_QUESTION' } // expandedNoComments -> collapsed
  | { type: 'SHOW_COMMENTS' } // collapsed OR expandedNoComments -> expandedWithComments
  | { type: 'HIDE_COMMENTS' } // expandedWithComments -> expandedNoComments
  | { type: 'LOCK_EXPANDED' } // expandedWithComments -> expandedWithCommentsLocked
  | { type: 'UNLOCK_EXPANDED' } // expandedWithCommentsLocked -> expandedWithComments
  | { type: 'SET_TRUNCATE'; truncate: boolean }

export const initialUIState: UIState = {
  expandedState: 'collapsed',
  truncateText: true,
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
        return { ...state, expandedState: 'expandedWithComments' }
      } else {
        return state
      }
    }
    case 'HIDE_COMMENTS': {
      // can only go from expandedWithComments to expandedNoComments
      if (state.expandedState === 'expandedWithComments') {
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
    case 'SET_TRUNCATE': {
      // technically I only ever use this to set truncate to true, but I wanted to leave this here as an example of how you can pass extra data to a reducer
      return { ...state, truncateText: action.truncate }
    }
    default: {
      console.error(
        'Invalid action type used inside AsyncQuestionCardUIReducer',
      )
      return state
    }
  }
}
