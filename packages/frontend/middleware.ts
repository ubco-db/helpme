import { NextRequest, NextResponse } from 'next/server'
import { OrganizationRole } from './app/typings/user'
import { isProd, User, UserRole } from './middlewareType'
import * as Sentry from '@sentry/nextjs'
import { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies'
import Axios, { AxiosResponse } from 'axios'
import { fetchAuthToken } from '@/app/api/cookie-utils'

// These are the public pages that do not require authentication. Adding an * will match any characters after the page (e.g. if the page has search query params).
const publicPages = [
  '/login',
  '/register*',
  '/failed*',
  '/password*',
  '/',
  '/invite*',
  '/qi/*', // queue invite page
  '/error_pages*',
  '/lti/login',
  '/lti/register*',
  '/lti/failed*',
  '/lti/password*',
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

const axiosInstance = Axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
})
async function fetchUser(
  cookies: RequestCookies,
  cookieName = 'auth_token',
): Promise<AxiosResponse | undefined> {
  if (!cookies.has(cookieName)) {
    return undefined
  }

  const authToken = await fetchAuthToken()
  const response = await axiosInstance.get(`/api/v1/profile`, {
    headers: { cookie: authToken },
  })

  if (response.headers?.['content-type']?.includes('application/json')) {
    if (response.status >= 400) {
      const body = response.data
      return Promise.reject(body)
    }
    return response // Type assertion needed due to conditional return type
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

  const searchParams =
    url.indexOf('?') > 0
      ? url
          .substring(url.indexOf('?') + 1)
          .split('&')
          .map((v) => v.split('='))
          .map(([k, v]) => ({ [decodeURIComponent(k)]: decodeURIComponent(v) }))
          .reduce((p, c) => ({ ...p, ...c }), {})
      : {}
  console.log(searchParams)
  const isLaunchFromLti = searchParams['launch_from_lti']

  if (isLaunchFromLti) {
    const response = NextResponse.redirect(new URL(`/login`, url))
    response.cookies.delete('lti_auth_token')
    return response
  }

  // // Case: If not on production, allow access to /dev pages (to skip other middleware checks)
  if (nextUrl.pathname.startsWith('/dev') && !isProd()) {
    return NextResponse.next()
  }

  const hasToken = cookies.has('lti_auth_token') || cookies.has('auth_token')
  const isInLti = cookies.has('lti_auth_token') && !cookies.has('auth_token')
  const cookieName = isInLti ? 'lti_auth_token' : 'auth_token'
  const defaultPage = isInLti ? '/lti' : '/courses'

  // Case: User tries to access a page that requires authentication without an auth token
  if (!hasToken && !isPublicPageRequested) {
    return NextResponse.redirect(
      new URL(
        `${isInLti ? '/lti' : ''}/login?redirect=${nextUrl.pathname}`,
        url,
      ),
    )
  }

  let response: AxiosResponse | undefined
  let userData: User | undefined

  try {
    response = await fetchUser(cookies, cookieName)

    userData =
      response &&
      ((response.status >= 200 && response.status < 300) ||
        response.status == 302)
        ? (response.data as User)
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
        new URL(
          `${isInLti ? '/lti' : ''}/login?error=fetchError&redirect=${nextUrl.pathname}`,
          url,
        ),
      )
    })
  }

  // Case: User has auth token and tries to access a page that requires authentication
  if (response && !isPublicPageRequested) {
    // If the auth token is invalid, redirect to /login
    if (response.status === 401) {
      // I have no clue if the session is actually expired or what exactly.
      return await handleRetry(
        request, // pass in the request (gets sent to middleware() again)
        () => {
          // run this function once out of retry attempts
          const response = NextResponse.redirect(
            new URL(
              `${isInLti ? '/lti' : ''}/login?error=sessionExpired&redirect=${nextUrl.pathname}`,
              url,
            ),
          )
          response.cookies.delete('auth_token')
          response.cookies.delete('lti_auth_token')
          return response
        },
        1, // retry only once
      )
    } else if (response.status >= 300 && response.status < 400) {
      // The user was redirected (from some other part of our app, maybe even this middleware)
      // We should just let them through to the next page
      return NextResponse.next()
    } else if (response.status === 429) {
      // Too many requests (somehow. This should never happen since the getUser api has no throttler, but i'm leaving this here in case that changes).
      // Ideally, we would just do an antd message.error, but we can't do that in middelware since it's server-side.
      // The best solution we have right now is just sending them to the /429 page, which has a back button.
      // This should now never happen since the handleRetry will try again after 0.25s, 1s, and then 2s.
      return await handleRetry(request, () => {
        return NextResponse.redirect(new URL('/error_pages/429', url))
      })
    } else if (response.status >= 400) {
      // this really is not meant to happen
      if (response.headers['content-type']?.includes('application/json')) {
        const userData: User = await response.data
        Sentry.captureEvent({
          message: `Unknown error in middleware ${response.status}: ${response.statusText}`,
          level: 'error',
          extra: {
            requestedRoute: nextUrl.pathname,
            statusText: response.statusText,
            statusCode: response.status,
            userId: userData.id,
            userEmail: userData.email,
            userRole: userData.organization?.organizationRole,
          },
        })
      } else if (response.headers['content-type']?.includes('text/html')) {
        const text = (await response.data) as string
        Sentry.captureEvent({
          message: `Unknown error in middleware ${response.status}: ${response.statusText}`,
          level: 'error',
          extra: {
            requestedRoute: nextUrl.pathname,
            statusText: response.statusText,
            statusCode: response.status,
            text,
          },
        })
      } else {
        Sentry.captureEvent({
          message: `Unknown error in middleware ${response.status}: ${response.statusText}`,
          level: 'error',
          extra: {
            requestedRoute: nextUrl.pathname,
            statusText: response.statusText,
            statusCode: response.status,
          },
        })
      }
      return await handleRetry(request, () => {
        const redirectResponse = NextResponse.redirect(
          new URL(
            `${isInLti ? '/lti' : ''}/login?error=errorCode${response.status}${encodeURIComponent(response.statusText)}&redirect=${nextUrl.pathname}`,
            url,
          ),
        )
        redirectResponse.cookies.delete('auth_token')
        redirectResponse.cookies.delete('lti_auth_token')
        return redirectResponse
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
        new URL(
          `/api/v1/logout?redirect=${nextUrl.pathname}${isInLti ? '&lti=true' : ''}`,
          url,
        ),
      )
    }
  }

  if (userData && !isPublicPageRequested) {
    // Case: User has auth token and tries to access a page that requires email verification.
    //  Check:
    //  - if page is /verify and email is not verified, allow access
    //  - if page is /verify and email is verified, redirect to /courses
    //  - if email is not verified, redirect to /verify
    if (
      nextUrl.pathname.startsWith(`${isInLti ? '/lti' : ''}/verify`) &&
      !isEmailVerified(userData)
    ) {
      return NextResponse.next()
    } else if (
      nextUrl.pathname.startsWith(`${isInLti ? '/lti' : ''}/verify`) &&
      isEmailVerified(userData)
    ) {
      return NextResponse.redirect(new URL(defaultPage, url))
    } else if (!isEmailVerified(userData)) {
      return NextResponse.redirect(
        new URL(`${isInLti ? '/lti' : ''}/verify`, url),
      )
    }

    // Redirect to /courses if user is not an admin and tries to access pages that should be accessed by organization admin (or professor)
    if (
      nextUrl.pathname.startsWith('/organization') &&
      userData.organization &&
      userData.organization.organizationRole !== OrganizationRole.ADMIN &&
      userData.organization.organizationRole !== OrganizationRole.PROFESSOR
    ) {
      return NextResponse.redirect(new URL(defaultPage, url))
    }

    // Redirect to /courses if user is not an admin and tries to access pages that should be accessed by an application admin
    if (
      nextUrl.pathname.startsWith('/admin') &&
      userData.userRole !== UserRole.ADMIN
    ) {
      return NextResponse.redirect(new URL(defaultPage, url))
    }
  }

  // Case: User has auth token and tries to access a public page that isn't /invite or /lti or /qi or /error_pages
  if (
    isPublicPageRequested &&
    hasToken &&
    !nextUrl.pathname.startsWith('/invite') &&
    !nextUrl.pathname.startsWith('/qi/') &&
    !nextUrl.pathname.startsWith('/error_pages')
  ) {
    return NextResponse.redirect(new URL(defaultPage, url))
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
