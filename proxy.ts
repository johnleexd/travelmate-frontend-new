import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const role = request.cookies.get('user_role')?.value;

  const url = request.nextUrl.clone();

  // If path starts with dashboard routes
  if (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/owner/dashboard') || url.pathname.startsWith('/admin/dashboard')) {
    if (!token) {
      // Redirect to landing page with alert
      url.pathname = '/';
      url.searchParams.set('auth_error', 'unauthenticated');
      return NextResponse.redirect(url);
    }

    // Role-based route guard
    if (url.pathname.startsWith('/admin/dashboard')) {
      if (role !== 'admin') {
        url.pathname = role === 'owner' ? '/owner/dashboard' : '/dashboard';
        return NextResponse.redirect(url);
      }
    } else if (url.pathname.startsWith('/owner/dashboard')) {
      if (role !== 'owner') {
        url.pathname = role === 'admin' ? '/admin/dashboard' : '/dashboard';
        return NextResponse.redirect(url);
      }
    } else if (url.pathname === '/dashboard') {
      if (role !== 'traveler') {
        url.pathname = role === 'admin' ? '/admin/dashboard' : '/owner/dashboard';
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard',
    '/owner/dashboard',
    '/admin/dashboard',
  ],
};
