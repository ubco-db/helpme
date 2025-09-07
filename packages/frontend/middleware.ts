import { NextRequest, NextResponse } from 'next/server'
import { OrganizationRole } from './app/typings/user'
import { isProd, User } from './middlewareType'
import * as Sentry from '@sentry/nextjs'
import { UserRole } from '@koh/common'
import { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies'
import getAPI from '@/app/api/server'

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

async function fetchUser(cookies: RequestCookies) {
  if (!cookies.has('auth_token') && !cookies.has('lti_auth_token')) {
    return undefined
  }

  const API = await getAPI()
  const response = await API.profile.fullResponse()

  if (response.headers?.['content-type']?.includes('application/json')) {
    if (response.status >= 400) {
      const body = response.data
      return Promise.reject(body)
    }
    return response.data as any // Type assertion needed due to conditional return type
  } else if (response.headers?.['content-type']?.includes('text/html')) {
    const text = response.data as string
    Sentry.captureEvent({
      message: `Unknown error in getUser ${response.status}: ${response.statusText}`,
      level: 'error',
      extra: {
        text,
        response,
      },
    })
    return Promise.reject(text)
  } else {
    return Promise.reject('Unknown error in getUser' + JSON.stringify(response))
  }
}

export async function middleware(
  request: NextRequest,
): Promise<NextResponse<unknown>> {
  const { url, nextUrl, cookies } = request

  const isPublicPageRequested = isPublicPage(nextUrl.pathname)

  // // Case: If not on production, allow access to /dev pages (to skip other middleware checks)
  if (nextUrl.pathname.startsWith('/dev') && !isProd()) {
    return NextResponse.next()
  }

  // Case: User tries to access a page that requires authentication without an auth token
  if (!cookies.has('auth_token') && !isPublicPageRequested) {
    return NextResponse.redirect(
      new URL(`/login?redirect=${nextUrl.pathname}`, url),
    )
  }

  let data: Response | undefined
  let userData: User | undefined

  try {
    data = await fetchUser(cookies)

    userData =
      data && (data.ok || data.status == 302)
        ? ((await data?.json()) as User)
        : undefined
  } catch (error) {
    return await handleRetry(request, () => {
      console.error('Error fetching user data in middleware:', error)
      Sentry.captureEvent({
        message: `Unknown error in middleware`,
        level: 'error',
        extra: {
          requestedRoute: nextUrl.pathname,
          error,
        },
      })
      return NextResponse.redirect(
        new URL(`/login?error=fetchError&redirect=${nextUrl.pathname}`, url),
      )
    })
  }

  // Case: User has auth token and tries to access a page that requires authentication
  if (data && !isPublicPageRequested) {
    // If the auth token is invalid, redirect to /login
    if (data.status === 401) {
      // I have no clue if the session is actually expired or what exactly.
      return await handleRetry(
        request, // pass in the request (gets sent to middleware() again)
        () => {
          // run this function once out of retry attempts
          const response = NextResponse.redirect(
            new URL(
              `/login?error=sessionExpired&redirect=${nextUrl.pathname}`,
              url,
            ),
          )
          response.cookies.delete('auth_token')
          return response
        },
        1, // retry only once
      )
    } else if (data.status >= 300 && data.status < 400) {
      // The user was redirected (from some other part of our app, maybe even this middleware)
      // We should just let them through to the next page
      return NextResponse.next()
    } else if (data.status === 429) {
      // Too many requests (somehow. This should never happen since the getUser api has no throttler, but i'm leaving this here in case that changes).
      // Ideally, we would just do an antd message.error, but we can't do that in middelware since it's server-side.
      // The best solution we have right now is just sending them to the /429 page, which has a back button.
      // This should now never happen since the handleRetry will try again after 0.25s, 1s, and then 2s.
      return await handleRetry(request, () => {
        return NextResponse.redirect(new URL('/error_pages/429', url))
      })
    } else if (data.status >= 400) {
      // this really is not meant to happen
      if (data.headers.get('content-type')?.includes('application/json')) {
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
      } else if (data.headers.get('content-type')?.includes('text/html')) {
        const text = await data.text()
        Sentry.captureEvent({
          message: `Unknown error in middleware ${data.status}: ${data.statusText}`,
          level: 'error',
          extra: {
            requestedRoute: nextUrl.pathname,
            statusText: data.statusText,
            statusCode: data.status,
            text,
          },
        })
      } else {
        Sentry.captureEvent({
          message: `Unknown error in middleware ${data.status}: ${data.statusText}`,
          level: 'error',
          extra: {
            requestedRoute: nextUrl.pathname,
            statusText: data.statusText,
            statusCode: data.status,
          },
        })
      }
      return await handleRetry(request, () => {
        const response = NextResponse.redirect(
          new URL(
            `/login?error=errorCode${data.status}${encodeURIComponent(data.statusText)}&redirect=${nextUrl.pathname}`,
            url,
          ),
        )
        response.cookies.delete('auth_token')
        return response
      })
    }
  }

  // Case: User has auth token, but auth token defines restrict paths
  // Solution: Redirect to /login if there's no match
  // Skipped if the requested page is not a public page
  if (
    userData &&
    userData.restrictPaths != undefined &&
    !isPublicPageRequested
  ) {
    const pathOrPaths = userData.restrictPaths
    const requestPath = nextUrl.pathname
    let isAllowedOnPath: boolean
    if (Array.isArray(pathOrPaths)) {
      isAllowedOnPath = false
      for (const path of pathOrPaths) {
        if (path.startsWith('r')) {
          const regex = new RegExp(path.substring(1), 'i')
          if (regex.test(requestPath)) {
            isAllowedOnPath = true
            break
          }
        } else {
          if (requestPath == path) {
            isAllowedOnPath = true
            break
          }
        }
      }
    } else {
      if (pathOrPaths.startsWith('r')) {
        const regex = new RegExp(pathOrPaths.substring(1), 'i')
        isAllowedOnPath = regex.test(requestPath)
      } else {
        isAllowedOnPath = requestPath == (pathOrPaths as string)
      }
    }

    if (!isAllowedOnPath) {
      return NextResponse.redirect(
        new URL(`/api/v1/logout?redirect=${nextUrl.pathname}`, url),
      )
    }
  }

  if (userData && !isPublicPageRequested) {
    // Case: User has auth token and tries to access a page that requires email verification.
    //  Check:
    //  - if page is /verify and email is not verified, allow access
    //  - if page is /verify and email is verified, redirect to /courses
    //  - if email is not verified, redirect to /verify
    if (nextUrl.pathname.startsWith('/verify') && !isEmailVerified(userData)) {
      return NextResponse.next()
    } else if (
      nextUrl.pathname.startsWith('/verify') &&
      isEmailVerified(userData)
    ) {
      return NextResponse.redirect(new URL('/courses', url))
    } else if (!isEmailVerified(userData)) {
      return NextResponse.redirect(new URL('/verify', url))
    }

    // Redirect to /courses if user is not an admin and tries to access pages that should be accessed by organization admin (or professor)
    if (
      nextUrl.pathname.startsWith('/organization') &&
      userData.organization &&
      userData.organization.organizationRole !== OrganizationRole.ADMIN &&
      userData.organization.organizationRole !== OrganizationRole.PROFESSOR
    ) {
      return NextResponse.redirect(new URL('/courses', url))
    }

    // Redirect to /courses if user is not an admin and tries to access pages that should be accessed by an application admin
    if (
      nextUrl.pathname.startsWith('/admin') &&
      userData.userRole !== UserRole.ADMIN
    ) {
      return NextResponse.redirect(new URL('/courses', url))
    }
  }

  // Case: User has auth token and tries to access a public page that isn't /invite or /lti or /qi or /error_pages
  if (
    isPublicPageRequested &&
    cookies.has('auth_token') &&
    !nextUrl.pathname.startsWith('/lti') &&
    !nextUrl.pathname.startsWith('/invite') &&
    !nextUrl.pathname.startsWith('/qi/') &&
    !nextUrl.pathname.startsWith('/error_pages')
  ) {
    return NextResponse.redirect(new URL('/courses', url))
  }

  return NextResponse.next()
}

/**
 * Handles retry logic for failed requests.
 * On 1st retry wait 0.25s, on 2nd retry add a 1s delay, on 3rd retry add a 2s delay
 *  */
async function handleRetry(
  request: NextRequest,
  failureCallback: () => NextResponse,
  maxRetries = 3,
) {
  const { cookies } = request
  const retryCookie = cookies.get('retry_attempts')?.value ?? '0'
  const currentRetries = Number(retryCookie)

  // 1st retry → 250ms, 2nd → 1000ms, 3rd → 2000ms
  const WAIT_TIMES = [250, 1000, 2000]

  if (currentRetries < maxRetries) {
    const waitTime = WAIT_TIMES[currentRetries] ?? 2000
    await sleep(waitTime)

    // I realize that setting cookies like this essentially turns it into a counter variable, but I tried adding a counter variable to middleware() instead and it didn't work
    cookies.set('retry_attempts', (currentRetries + 1).toString())
    return await middleware(request) // try again
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
     * - sentry-tunnel (Sentry monitoring)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|scripts|styles|sentry-tunnel).*)',
  ],
}
