import { NextRequest, NextResponse } from 'next/server'
import { userApi } from './app/api/userApi'
import { OrganizationRole } from './app/typings/user'
import { User } from '@koh/common'

const publicPages = ['/login', '/register', '/failed*', '/password*', '/']

const isPublicPages = (url: string) => {
  return publicPages.some((page) => {
    const regex = new RegExp(`^${page.replace('*', '.*')}$`)
    return regex.test(url)
  })
}

const isEmailVerified = (userData: User): boolean => {
  return userData.emailVerified
}

const isValidAuthToken = async () => {
  return await userApi.getUser()
}

export async function middleware(request: NextRequest) {
  const { url, nextUrl, cookies } = request

  const isAuthPageRequested = isPublicPages(nextUrl.pathname)

  // Case: User tries to access a page that requires authentication without an auth token
  if (!cookies.has('auth_token') && !isAuthPageRequested) {
    return NextResponse.redirect(new URL('/login', url))
  }

  // Case: User has auth token and tries to access a page that requires authentication
  if (cookies.has('auth_token') && !isAuthPageRequested) {
    // Check if the auth token is valid
    const data = await isValidAuthToken()

    // If the auth token is invalid, redirect to /login
    if (data.status == 401) {
      const response = NextResponse.redirect(new URL('/login', url))
      response.cookies.delete('auth_token')
      return response
    }

    const userData = await data.json()

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

    // Redirect to /courses if user is not an admin and tries to access pages that should be accessed by organization admin
    if (
      nextUrl.pathname.startsWith('/organization') &&
      userData?.organizationRole !== OrganizationRole.ADMIN
    ) {
      return NextResponse.redirect(new URL('/courses', url))
    }
  }

  // Case: User has auth token and tries to access a public page
  if (isAuthPageRequested && cookies.has('auth_token')) {
    return NextResponse.redirect(new URL('/courses', url))
  }

  NextResponse.next()
}

export const config = {
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
    '/((?!api|_next/static|_next/image|favicon.ico|scripts|styles).*)',
  ],
}
