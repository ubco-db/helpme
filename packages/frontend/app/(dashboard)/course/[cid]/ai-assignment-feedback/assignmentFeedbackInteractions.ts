import type {
  Annotation,
  FunctionDimension,
  LinguisticLevel,
} from './assignmentFeedbackTypes'

export type FunctionFilter = 'all' | FunctionDimension
export type LevelFilter = 'all' | LinguisticLevel
export type FeedbackTab = 'annotations' | 'summary'

export interface ViewerState {
  activeAnnotationId: number | null
  currentTab: FeedbackTab
  functionFilter: FunctionFilter
  levelFilter: LevelFilter
}

export const initialViewerState: ViewerState = {
  activeAnnotationId: null,
  currentTab: 'annotations',
  functionFilter: 'all',
  levelFilter: 'all',
}

export function activate(
  state: ViewerState,
  annotationId: number,
): ViewerState {
  return {
    ...state,
    activeAnnotationId:
      state.activeAnnotationId === annotationId ? null : annotationId,
  }
}

export function setFunctionFilter(
  state: ViewerState,
  filter: FunctionFilter,
): ViewerState {
  return { ...state, functionFilter: filter }
}

export function setLevelFilter(
  state: ViewerState,
  filter: LevelFilter,
): ViewerState {
  return { ...state, levelFilter: filter }
}

export function switchTab(state: ViewerState, tab: FeedbackTab): ViewerState {
  return { ...state, currentTab: tab }
}

export function filterAnnotations(
  annotations: Annotation[],
  state: ViewerState,
): Annotation[] {
  return annotations.filter((item) => {
    if (
      state.functionFilter !== 'all' &&
      item.function !== state.functionFilter
    ) {
      return false
    }
    if (state.levelFilter !== 'all' && item.level !== state.levelFilter) {
      return false
    }
    return true
  })
}
