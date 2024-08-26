export const PROD_URL = 'https://coursehelp.ubc.ca'

// Get domain. works on node and browser
const domain = (): string | false =>
  process.env.DOMAIN ||
  (typeof window !== 'undefined' && window?.location?.origin)

export const getEnv = (): 'production' | 'dev' => {
  switch (domain()) {
    case PROD_URL:
      return 'production'
    default:
      return 'dev'
  }
}

export const isProd = (): boolean => domain() === PROD_URL

export class User {
  id!: number
  email!: string
  firstName?: string
  lastName?: string
  name!: string
  photoURL!: string
  defaultMessage?: string
  sid?: number
  includeDefaultMessage!: boolean
  courses!: UserCourse[]
  pendingCourses?: KhouryProfCourse[]
  desktopNotifsEnabled!: boolean
  desktopNotifs!: DesktopNotifPartial[]
  insights!: string[]
  userRole!: string
  organization?: OrganizationUserPartial
  chat_token!: ChatTokenPartial
  accountType!: AccountType
  emailVerified!: boolean
}

export enum AccountType {
  LEGACY = 'legacy',
  GOOGLE = 'google',
  SHIBBOLETH = 'shibboleth',
}

export class ChatTokenPartial {
  id!: number
  token!: string
  used!: number
  max_uses!: number
}

export class OrganizationUserPartial {
  id!: number
  orgId!: number
  organizationName!: string
  organizationDescription!: string
  organizationLogoUrl!: string
  organizationBannerUrl!: string
  organizationRole!: string
}

export class DesktopNotifPartial {
  id!: number
  endpoint!: string
  name?: string
  createdAt!: Date
}

export interface UserCourse {
  course: CoursePartial
  role: Role
}

export interface CoursePartial {
  id: number
  name: string
}

export enum Role {
  STUDENT = 'student',
  TA = 'ta',
  PROFESSOR = 'professor',
}

export class KhouryProfCourse {
  crns!: number[]
  semester!: string
  name!: string
}
