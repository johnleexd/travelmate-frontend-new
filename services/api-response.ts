import { isApiErrorResponse, type ApiErrorCode } from '../lib/generated/api-error-contract.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: ApiErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(message: string, status: number, code?: ApiErrorCode, retryable = false, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export function isAuthenticationError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export async function handleResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(response.ok ? 'The server returned an invalid response.' : 'TravelMate could not reach a required service. Please try again.');
    }
  }
  if (!response.ok) {
    if (isApiErrorResponse(data)) throw new ApiError(data.error, response.status, data.code, data.retryable, data.details);
    const legacyError = data && typeof data === 'object' && 'error' in data ? String((data as { error?: unknown }).error || '') : '';
    throw new ApiError(legacyError || `Request failed (${response.status}).`, response.status);
  }
  return data as T;
}
