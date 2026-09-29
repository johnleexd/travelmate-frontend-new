import { NextResponse } from 'next/server';

export async function forwardGoogleOAuth(request: Request, path: string): Promise<Response> {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const cookie = request.headers.get('cookie');
  try {
    const upstream = await fetch(`${backendUrl}${path}${new URL(request.url).search}`, {
      headers: cookie ? { cookie } : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
    const location = upstream.headers.get('location');
    if (upstream.status !== 302 || !location) throw new Error(`OAuth backend returned ${upstream.status}.`);

    const response = NextResponse.redirect(location, 302);
    response.headers.set('Cache-Control', 'no-store');
    for (const value of upstream.headers.getSetCookie()) response.headers.append('Set-Cookie', value);
    return response;
  } catch (error) {
    console.error('[TravelMate] Google OAuth forwarding failed:', error instanceof Error ? error.message : error);
    return NextResponse.redirect(new URL('/?auth_error=oauth_unavailable', request.url), 302);
  }
}
