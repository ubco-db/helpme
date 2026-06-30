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
  const profInviteCookieString = cookieStore.get('profInviteInfo')
  if (profInviteCookieString) {
    const decodedCookie = decodeURIComponent(profInviteCookieString.value)
    const cookieParts = decodedCookie.split(',')
    // const profInviteId = cookieParts[0] // not used, but left here to showcase they are available
    const orgId = Number(cookieParts[1])
    const courseId = Number(cookieParts[2])
    //const profInviteCode = cookieParts[3]
    if (orgId) {
      invitedOrgId = orgId
    }
    if (courseId) {
      invitedCourseId = courseId
    }
  } else if (queueInviteCookieString) {
    const decodedCookie = decodeURIComponent(queueInviteCookieString.value)
    const cookieParts = decodedCookie.split(',')
    const courseId = Number(cookieParts[0])
    const queueId = Number(cookieParts[1])
    const orgId = Number(cookieParts[2])
    const courseInviteCode = cookieParts[3]
      ? Buffer.from(cookieParts[3], 'base64').toString('utf-8')
      : null
    if (orgId) {
      invitedOrgId = orgId
    }
    if (queueId) {
      invitedQueueId = queueId
    }
    if (courseId) {
      invitedCourseId = courseId
    }
    if (courseInviteCode) {
      // note: this will only get set if the queueInvite had willInviteToCourse set to true
      invitedCourseInviteCode = courseInviteCode
    }
  } else {
    // get courseId from SECURE_REDIRECT (from invite code) and get the course's organization, and then set the organization to that
    const redirectCookieString = cookieStore.get('__SECURE_REDIRECT')
    if (redirectCookieString) {
      const decodedCookie = decodeURIComponent(
        redirectCookieString.value,
      ).split(',')
      const orgId = Number(decodedCookie[2])
      const courseId = Number(decodedCookie[0])
      const courseInviteCode = decodedCookie[1]
      if (orgId) {
        invitedOrgId = orgId
      }
      if (courseId) {
        invitedCourseId = courseId
      }
      if (courseInviteCode) {
        invitedCourseInviteCode = courseInviteCode
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
