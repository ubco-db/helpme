import { AsyncCreator, Role } from '@koh/common'
import { Action } from '../components/AsyncQuestionCardUIReducer'

export type CommentAuthorType = Role | 'you' | 'author'

export interface CommentProps {
  commentId: number
  questionId: number
  author: AsyncCreator
  isAnonymous: boolean
  questionIsAnonymous: boolean
  content: string
  onDeleteSuccess: () => void
  onEditSuccess: (newCommentText: string, newCommentAnonymous: boolean) => void
  dispatchUIStateChange: (action: Action) => void
  IAmStaff: boolean
  showStudents: boolean
  datetime: React.ReactNode
}
