import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const forwardedProtocol = request.headers
      .get('x-forwarded-proto')
      ?.split(',', 1)[0]
      ?.trim()
      .toLowerCase();
    const usesHttps = request.nextUrl.protocol === 'https:' || forwardedProtocol === 'https';

    if (!usesHttps) {
      const secureUrl = request.nextUrl.clone();
      secureUrl.protocol = 'https:';
      return NextResponse.redirect(secureUrl, 308);
    }
  }

  const token = request.cookies.get('travelmate_session')?.value;

  const url = request.nextUrl.clone();

  // If path starts with dashboard routes
  if (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/admin/dashboard')) {
    if (!token) {
      // Redirect to landing page with alert
      url.pathname = '/';
      url.searchParams.set('auth_error', 'unauthenticated');
      return NextResponse.redirect(url);
    }

    // Proxy is an optimistic presence check only. Every page data request and
    // mutation performs authoritative signed-session and role validation.
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/admin/:path*',
    '/account/:path*',
    '/api/:path*',
  ],
};
