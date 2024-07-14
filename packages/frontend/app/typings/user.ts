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

export interface LoginData {
  email: string
  password: string
  recaptchaToken: string
}

export enum OrganizationRole {
  MEMBER = 'member',
  ADMIN = 'admin',
  PROFESSOR = 'professor',
}

export enum CourseRole {
  STUDENT = 'student',
  PROFESSOR = 'professor',
  TA = 'ta',
}
