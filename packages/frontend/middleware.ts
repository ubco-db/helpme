import { NextRequest, NextResponse } from 'next/server'

const authPages = ['/login']

const isAuthPages = (url: string) =>
  authPages.some((page) => page.startsWith(url))

export async function middleware(request: NextRequest) {
  const { url, nextUrl, cookies } = request

  const isAuthPageRequested = isAuthPages(nextUrl.pathname)

  if (!cookies.has('auth_token') && !isAuthPageRequested) {
    return NextResponse.redirect(new URL('/login', url))
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
