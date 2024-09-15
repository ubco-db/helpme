import { NextRequest, NextResponse } from 'next/server'
import { userApi } from './app/api/userApi'
import { OrganizationRole } from './app/typings/user'
import { isProd, User } from './middlewareType'

// These are the public pages that do not require authentication. Adding an * will match any characters after the page (e.g. if the page has search query params).
const publicPages = [
  '/login',
  '/register',
  '/failed*',
  '/password*',
  '/',
  '/invite*',
  '/qi/*', // queue invite page
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
        const response = NextResponse.redirect(
          new URL('/login?error=sessionExpired', url),
        )
        response.cookies.delete('auth_token')
        return response
      } else if (data.status >= 400) {
        // this really is not meant to happen
        const response = NextResponse.redirect(
          new URL(
            `/login?error=errorCode${data.status}${encodeURIComponent(data.statusText)}`,
            url,
          ),
        )
        response.cookies.delete('auth_token')
        return response
      } else if (!data.ok && data.status !== 304) {
        // do be warned that if it gets to this stage, infinite redirects will happen until the browser stops it TODO: pls fix
        throw new Error(data.status + ': ' + data.statusText)
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
    } catch (error) {
      console.error('Error fetching user data in middleware:', error)
      return NextResponse.redirect(new URL('/login?error=redirect', url))
    }
  }

  // Case: User has auth token and tries to access a public page that isn't /invite
  if (
    isPublicPageRequested &&
    cookies.has('auth_token') &&
    !nextUrl.pathname.startsWith('/invite') &&
    !nextUrl.pathname.startsWith('/qi/')
  ) {
    console.log('nexturl', nextUrl.pathname)
    return NextResponse.redirect(new URL('/courses', url))
  }

  return NextResponse.next()
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
