/** The outer TLS proxy must overwrite forwarded headers and keep Next private. */
export function oauthRequestHeaders(request: Request): Headers {
  const headers = new Headers();
  const cookie = request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  const protocol = request.headers.get('x-forwarded-proto')?.split(',', 1)[0]?.trim().toLowerCase();
  headers.set('x-forwarded-proto', protocol === 'https' || protocol === 'http' ? protocol : new URL(request.url).protocol.slice(0, -1));
  const clientIp = request.headers.get('x-forwarded-for')?.split(',', 1)[0]?.trim();
  if (clientIp) headers.set('x-forwarded-for', clientIp);
  return headers;
}
