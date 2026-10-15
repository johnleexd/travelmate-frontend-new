type BackendEnvironment = { BACKEND_URL?: string; VERCEL?: string };

/** Keep the upstream server-only; Vercel cannot reach a developer's localhost. */
export function resolveBackendUrl(environment: BackendEnvironment = {
  BACKEND_URL: process.env.BACKEND_URL,
  VERCEL: process.env.VERCEL,
}): string {
  const value = environment.BACKEND_URL?.trim();
  if (!value && environment.VERCEL === '1') {
    throw new Error('Set BACKEND_URL in Vercel to your public HTTPS backend origin before building.');
  }
  let url: URL;
  try { url = new URL(value || 'http://localhost:5000'); }
  catch { throw new Error('BACKEND_URL must be an absolute HTTP or HTTPS backend origin.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('BACKEND_URL must be a backend origin without credentials, an /api path, query, or fragment.');
  }
  if (environment.VERCEL === '1' && (url.protocol !== 'https:' || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.startsWith('127.') || url.hostname === '[::1]')) {
    throw new Error('BACKEND_URL on Vercel must use your public HTTPS backend, such as https://api.travel-mate.site.');
  }
  return url.origin;
}
