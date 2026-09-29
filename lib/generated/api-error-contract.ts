// Generated from travelmate-backend-api/openapi/travelmate-api.json. Do not edit by hand.

export const API_ERROR_CODES = ["BAD_REQUEST","AUTHENTICATION_REQUIRED","FORBIDDEN","NOT_FOUND","CONFLICT","VALIDATION_ERROR","RATE_LIMITED","INTERNAL_ERROR","PROVIDER_UNAVAILABLE","GENERATION_CONFLICT","AI_PROVIDER_UNAVAILABLE","AI_GENERATION_FAILED"] as const;
export type ApiErrorCode = typeof API_ERROR_CODES[number];

export interface ApiErrorResponse {
  error: string;
  code: ApiErrorCode;
  retryable: boolean;
  details?: Record<string, unknown>;
}

const API_ERROR_CODE_SET = new Set<string>(API_ERROR_CODES);

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<ApiErrorResponse>;
  return typeof candidate.error === 'string' && candidate.error.length > 0
    && typeof candidate.code === 'string' && API_ERROR_CODE_SET.has(candidate.code)
    && typeof candidate.retryable === 'boolean'
    && (candidate.details === undefined || (typeof candidate.details === 'object' && candidate.details !== null && !Array.isArray(candidate.details)));
}
