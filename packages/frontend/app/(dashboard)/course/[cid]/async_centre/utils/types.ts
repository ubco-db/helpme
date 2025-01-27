import { AsyncCreator, Role } from '@koh/common'

export type CommentAuthorType = Role | 'you' | 'author'

export interface CommentProps {
  commentId: number
  questionId: number
  author: AsyncCreator
  content: string
  onDeleteSuccess: () => void
  onEditSuccess: (newCommentText: string) => void
  setIsLockedExpanded: (lockedExpanded: boolean) => void
  IAmStaff: boolean
  showStudents: boolean
  datetime: React.ReactNode
}
