import { cookies } from 'next/headers'
import { OrganizationProviderForInvitedCourse } from './components/OrganizationProviderForInvitedCourse'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  // get courseId from SECURE_REDIRECT (from invite code) and get the course's organization, and then set the organization to that
  let organizationIdForInvitedCourse: number | null = null
  const cookieStore = cookies()
  const redirectCookieString = cookieStore.get('__SECURE_REDIRECT')
  if (redirectCookieString) {
    const decodedCookie = decodeURIComponent(redirectCookieString.value)
    const orgId = decodedCookie.split(',')[2]
    if (Number(orgId)) {
      organizationIdForInvitedCourse = Number(orgId)
    }
  }
  return (
    <OrganizationProviderForInvitedCourse
      organizationIdForInvitedCourse={organizationIdForInvitedCourse}
    >
      {children}
    </OrganizationProviderForInvitedCourse>
  )
}
