import { NextRequest, NextResponse } from 'next/server'
import { userApi } from './app/api/userApi'
import { OrganizationRole } from './app/typings/user'

const publicPages = [
  '/login',
  '/register',
  '/failed/40001',
  '/failed/40002',
  'failed/40000',
]

const isPublicPages = (url: string) =>
  publicPages.some((page) => page.startsWith(url))

const isValidAuthToken = async () => {
  return await userApi.getUser()
}

export async function middleware(request: NextRequest) {
  const { url, nextUrl, cookies } = request

  const isAuthPageRequested = isPublicPages(nextUrl.pathname)

  console.log(url)
  if (!cookies.has('auth_token') && !isAuthPageRequested) {
    return NextResponse.redirect(new URL('/login', url))
  }

  if (cookies.has('auth_token') && !isAuthPageRequested) {
    const data = await isValidAuthToken()

    if (data.status == 401) {
      const response = NextResponse.redirect(new URL('/login', url))
      response.cookies.delete('auth_token')
      return response
    }

    const userData = await data.json()

    if (
      nextUrl.pathname.startsWith('/organization') &&
      userData?.organizationRole !== OrganizationRole.ADMIN
    ) {
      return NextResponse.redirect(new URL('/courses', url))
    }
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
