import { forwardGoogleOAuth } from './proxy';

export function GET(request: Request): Promise<Response> {
  return forwardGoogleOAuth(request, '/api/auth/oauth/google');
}
