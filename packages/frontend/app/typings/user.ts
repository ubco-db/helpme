export interface RegisterData {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  sid: number | null
  organizationId: number
  recaptchaToken: string
}

export enum OrganizationRole {
  MEMBER = 'member',
  ADMIN = 'admin',
  PROFESSOR = 'professor',
}

// TODO: these should probably be removed in favour of the types in @koh/common we already have
export enum CourseRole {
  STUDENT = 'student',
  PROFESSOR = 'professor',
  TA = 'ta',
}

export interface PasswordResetData {
  email: string
  recaptchaToken: string
  organizationId: number
}

export interface PasswordConfirmationData {
  password: string
  confirmPassword: string
}
