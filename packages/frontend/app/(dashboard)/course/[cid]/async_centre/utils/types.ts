import { Role } from '@koh/common'

export type CommentAuthorType = Role | 'you' | 'author'

export interface CommentProps {
  commentId: number
  questionId: number
  onDeleteSuccess: () => void
  onEditSuccess: (newCommentText: string) => void
  setIsLockedExpanded: (lockedExpanded: boolean) => void
  IAmStaff: boolean
  showStudents: boolean
  authorId: number
  authorAnonId: number
  authorName: string
  content: string
  datetime: React.ReactNode
  commenterRole: Role
  authorType: CommentAuthorType
  photoURL?: string
}
