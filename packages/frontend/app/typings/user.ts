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
