import { Role } from '@koh/common'

export type CommentAuthorType = Role | 'you' | 'author'

export interface CommentProps {
  authorId: number
  authorAnonId: number
  authorName: string
  content: string
  datetime: React.ReactNode
  authorType: CommentAuthorType
  avatar?: string
}
