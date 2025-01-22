import { Role } from '@koh/common'

export type CommentAuthorType = Role | 'you' | 'author'

export interface CommentProps {
  commentId: number
  questionId: number
  onDeleteSuccess: () => void
  onEditSuccess: (newCommentText: string) => void
  setIsLockedExpanded: (lockedExpanded: boolean) => void
  authorId: number
  authorAnonId: number
  authorName: string
  content: string
  datetime: React.ReactNode
  authorType: CommentAuthorType
  avatar?: string
}
