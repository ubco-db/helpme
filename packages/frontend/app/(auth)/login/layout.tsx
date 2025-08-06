import { cookies } from 'next/headers'
import { LoginRedirectInfoProvider } from './components/LoginRedirectInfoProvider'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  let invitedOrgId: number | null = null
  let invitedQueueId: number | null = null
  let invitedCourseId: number | null = null
  let invitedCourseInviteCode: string | null = null

  const cookieStore = await cookies()
  const queueInviteCookieString = cookieStore.get('queueInviteInfo')
  if (queueInviteCookieString) {
    const decodedCookie = decodeURIComponent(queueInviteCookieString.value)
    const cookieParts = decodedCookie.split(',')
    const courseId = cookieParts[0]
    const queueId = cookieParts[1]
    const orgId = cookieParts[2]
    const courseInviteCode = cookieParts[3]
      ? Buffer.from(cookieParts[3], 'base64').toString('utf-8')
      : null
    if (Number(orgId)) {
      invitedOrgId = Number(orgId)
    }
    if (Number(queueId)) {
      invitedQueueId = Number(queueId)
    }
    if (Number(courseId)) {
      invitedCourseId = Number(courseId)
    }
    if (courseInviteCode) {
      // note: this will only get set if the queueInvite had willInviteToCourse set to true
      invitedCourseInviteCode = courseInviteCode
    }
  } else {
    // get courseId from SECURE_REDIRECT (from invite code) and get the course's organization, and then set the organization to that
    const redirectCookieString = cookieStore.get('__SECURE_REDIRECT')
    if (redirectCookieString) {
      const decodedCookie = decodeURIComponent(redirectCookieString.value)
      const orgId = decodedCookie.split(',')[2]
      if (Number(orgId)) {
        invitedOrgId = Number(orgId)
      }
    }
  }

  return (
    <LoginRedirectInfoProvider
      invitedOrgId={invitedOrgId}
      invitedQueueId={invitedQueueId}
      invitedCourseId={invitedCourseId}
      invitedCourseInviteCode={invitedCourseInviteCode}
    >
      {children}
    </LoginRedirectInfoProvider>
  )
}
