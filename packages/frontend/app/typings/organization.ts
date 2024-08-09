export interface Organization {
  id: number
  name: string
  description: string
  logoUrl?: string
  bannerUrl?: string
  websiteUrl?: string
  ssoEnabled: boolean
  legacyAuthEnabled: boolean
  googleAuthEnabled: boolean
  ssoUrl?: string
}
