import { NextRequest, NextResponse } from 'next/server'
import { userApi } from './app/api/userApi'
import { OrganizationRole } from './app/typings/user'
import { isProd, User } from './middlewareType'
import * as Sentry from '@sentry/nextjs'
import { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies'

// These are the public pages that do not require authentication. Adding an * will match any characters after the page (e.g. if the page has search query params).
const publicPages = [
  '/login',
  '/register',
  '/failed*',
  '/password*',
  '/',
  '/invite*',
  '/qi/*', // queue invite page
  '/error_pages*',
]

const isPublicPage = (url: string) => {
  return publicPages.some((page) => {
    const regex = new RegExp(`^${page.replace('*', '.*')}$`)
    return regex.test(url)
  })
}

const isEmailVerified = (userData: User): boolean => {
  return userData.emailVerified
}

export async function middleware(request: NextRequest) {
  const { url, nextUrl, cookies } = request

  const isPublicPageRequested = isPublicPage(nextUrl.pathname)

  // // Case: If not on production, allow access to /dev pages (to skip other middleware checks)
  if (nextUrl.pathname.startsWith('/dev') && !isProd()) {
    return NextResponse.next()
  }

  // Case: User tries to access a page that requires authentication without an auth token
  if (!cookies.has('auth_token') && !isPublicPageRequested) {
    return NextResponse.redirect(new URL('/login', url))
  }

  // Case: User has auth token and tries to access a page that requires authentication
  if (cookies.has('auth_token') && !isPublicPageRequested) {
    // Check if the auth token is valid
    try {
      const data = await userApi.getUser()

      // If the auth token is invalid, redirect to /login
      if (data.status === 401) {
        // I have no clue if the session is actually expired or what exactly.
        return await handleRetry(
          cookies,
          () => {
            const response = NextResponse.redirect(
              new URL('/login?error=sessionExpired', url),
            )
            response.cookies.delete('retry_attempts')
            response.cookies.delete('auth_token')
            return response
          },
          1,
        ) // retry only once
      } else if (data.status === 429) {
        // Too many requests (somehow. This should never happen since the getUser api has no throttler, but i'm leaving this here in case that changes).
        // Ideally, we would just do an antd message.error, but we can't do that in middelware since it's server-side.
        // The best solution we have right now is just sending them to the /429 page, which has a back button.
        return await handleRetry(cookies, () => {
          const response = NextResponse.redirect(
            new URL('/error_pages/429', url),
          )
          response.cookies.delete('retry_attempts')
          return response
        })
      } else if (data.status >= 400 || (!data.ok && data.status !== 304)) {
        // this really is not meant to happen
        const userData: User = await data.json()
        Sentry.captureEvent({
          message: `Unknown error in middleware ${data.status}: ${data.statusText}`,
          level: 'error',
          extra: {
            requestedRoute: nextUrl.pathname,
            statusText: data.statusText,
            statusCode: data.status,
            userId: userData.id,
            userEmail: userData.email,
            userRole: userData.organization?.organizationRole,
          },
        })
        return await handleRetry(cookies, () => {
          const response = NextResponse.redirect(
            new URL(
              `/login?error=errorCode${data.status}${encodeURIComponent(data.statusText)}`,
              url,
            ),
          )
          response.cookies.delete('retry_attempts')
          response.cookies.delete('auth_token')
          return response
        })
      }

      const userData: User = await data.json()

      // Case: User has auth token and tries to access a page that requires email verification.
      //  Check:
      //  - if page is /verify and email is not verified, allow access
      //  - if page is /verify and email is verified, redirect to /courses
      //  - if email is not verified, redirect to /verify
      if (
        nextUrl.pathname.startsWith('/verify') &&
        !isEmailVerified(userData)
      ) {
        const response = NextResponse.next()
        response.cookies.delete('retry_attempts')
        return response
      } else if (
        nextUrl.pathname.startsWith('/verify') &&
        isEmailVerified(userData)
      ) {
        const response = NextResponse.redirect(new URL('/courses', url))
        response.cookies.delete('retry_attempts')
        return response
      } else if (!isEmailVerified(userData)) {
        const response = NextResponse.redirect(new URL('/verify', url))
        response.cookies.delete('retry_attempts')
        return response
      }

      // Redirect to /courses if user is not an admin and tries to access pages that should be accessed by organization admin (or professor)
      if (
        nextUrl.pathname.startsWith('/organization') &&
        userData.organization &&
        userData.organization.organizationRole !== OrganizationRole.ADMIN &&
        userData.organization.organizationRole !== OrganizationRole.PROFESSOR
      ) {
        const response = NextResponse.redirect(new URL('/courses', url))
        response.cookies.delete('retry_attempts')
        return response
      }
    } catch (error) {
      return await handleRetry(cookies, () => {
        console.error('Error fetching user data in middleware:', error)
        Sentry.captureEvent({
          message: `Unknown error in middleware`,
          level: 'error',
          extra: {
            requestedRoute: nextUrl.pathname,
            error,
          },
        })
        const response = NextResponse.redirect(
          new URL('/login?error=fetchError', url),
        )
        response.cookies.delete('retry_attempts')
        return response
      })
    }
  }

  // Case: User has auth token and tries to access a public page that isn't /invite
  if (
    isPublicPageRequested &&
    cookies.has('auth_token') &&
    !nextUrl.pathname.startsWith('/invite') &&
    !nextUrl.pathname.startsWith('/qi/') &&
    !nextUrl.pathname.startsWith('/error_pages')
  ) {
    const response = NextResponse.redirect(new URL('/courses', url))
    response.cookies.delete('retry_attempts')
    return response
  }

  const response = NextResponse.next()
  response.cookies.delete('retry_attempts')
  return response
}

/**
 * Handles retry logic for failed requests.
 * On 1st retry wait 0.25s, on 2nd retry add a 1s delay, on 3rd retry add a 2s delay
 *  */
async function handleRetry(
  cookies: RequestCookies,
  failureCallback: () => NextResponse,
  maxRetries = 3,
) {
  const retryCookie = cookies.get('retry_attempts')?.value ?? '0'
  const currentRetries = Number(retryCookie)

  // 1st retry → 250ms, 2nd → 1000ms, 3rd → 2000ms
  const WAIT_TIMES = [250, 1000, 2000]

  if (currentRetries < maxRetries) {
    const waitTime = WAIT_TIMES[currentRetries] ?? 2000
    await sleep(waitTime)

    const response = NextResponse.next()
    response.cookies.set('retry_attempts', (currentRetries + 1).toString())
    return response // try again
  } else {
    // Exceeded retry attempts
    return failureCallback()
  }
}

/**
 * Small helper to pause execution in middleware.
 */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const config = {
  unstable_allowDynamic: [
    '../common/node_modules/reflect-metadata/**',
    '../common/index.ts',
  ],
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - scripts
     * - styles
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|scripts|styles).*)',
  ],
}
