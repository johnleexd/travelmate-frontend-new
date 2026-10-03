import type { CurrentUserResponse } from '../lib/contracts.ts';
import { handleResponse } from './api-response.ts';

/** A failed service request is not evidence that the session has expired. */
export async function fetchCurrentUser(signal: AbortSignal): Promise<CurrentUserResponse['user'] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    signal.throwIfAborted();
    let response: Response;
    try {
      response = await fetch('/api/auth', {
        cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
      });
    } catch (error) {
      if (signal.aborted || attempt === 1) throw error;
      await new Promise<void>(resolve => setTimeout(resolve, 500));
      continue;
    }
    if (response.status === 401) return null;
    if (attempt === 0 && [500, 502, 503, 504].includes(response.status)) {
      await response.body?.cancel();
      await new Promise<void>(resolve => setTimeout(resolve, 500));
      continue;
    }
    const { user } = await handleResponse<CurrentUserResponse>(response);
    return user;
  }
  throw new Error('Your session could not be checked. Please try again.');
}
