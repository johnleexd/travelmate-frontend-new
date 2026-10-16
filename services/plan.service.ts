import { ApiError, handleResponse } from './api-response';
import type { PlanUsage, GenerationOperation, PlanCheckout } from '../lib/generated/plan-contracts';
export type { PlanUsage, GenerationOperation, PlanCheckout } from '../lib/generated/plan-contracts';
export async function latestTestCheckout(signal?: AbortSignal) {
  return handleResponse<{ order: PlanCheckout | null }>(await fetch('/api/plan/checkout', { cache: 'no-store', signal }));
}
export async function testCheckoutRequest(action: 'create' | 'verify' | 'cancel', id?: string, signal?: AbortSignal) {
  const path = action === 'create' ? '/api/plan/checkout' : `/api/plan/checkouts/${encodeURIComponent(id!)}/${action}`;
  return handleResponse<{ order: PlanCheckout }>(await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(action === 'create' ? { 'Idempotency-Key': crypto.randomUUID() } : {}) }, body: '{}', cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) }));
}
export function fetchPlan(signal?: AbortSignal): Promise<PlanUsage> {
  return fetch('/api/plan', { cache: 'no-store', signal }).then(handleResponse<PlanUsage>);
}
export function fetchGeneration<T>(key: string, signal?: AbortSignal): Promise<GenerationOperation<T>> {
  return fetch('/api/plan/operations/' + encodeURIComponent(key), { cache: 'no-store', signal }).then(handleResponse<GenerationOperation<T>>);
}
export const formatPlanDate = (date: string, timezone = 'Asia/Manila') => new Intl.DateTimeFormat('en-PH', { timeZone: timezone, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(date));
export function announcePlanLimit(error: unknown) {
  if (error instanceof ApiError && error.code === 'MONTHLY_AI_LIMIT') {
    window.dispatchEvent(new CustomEvent('travelmate-plan-limit', { detail: error.details }));
    return true;
  }
  return false;
}

// Shared across tabs and refreshes. Only an explicit new intent clears a key.
const memoryKeys = new Map<string, string>();
export async function persistentGenerationKey(userId: string, fingerprint: string) {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint))), byte => byte.toString(16).padStart(2, '0')).join('');
  const storageKey = `travelmate-generation:${userId}:${hash}`;
  const allocate = () => {
    try { const existing = localStorage.getItem(storageKey); if (existing) return existing; } catch { /* Memory key still fences this tab. */ }
    const key = memoryKeys.get(storageKey) ?? crypto.randomUUID();
    memoryKeys.set(storageKey, key);
    try { localStorage.setItem(storageKey, key); } catch { /* Server always enforces one active operation. */ }
    return key;
  };
  return navigator.locks ? navigator.locks.request(storageKey, allocate) : allocate();
}
export async function forgetGenerationKey(userId: string, fingerprint: string) {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint))), byte => byte.toString(16).padStart(2, '0')).join('');
  try { localStorage.removeItem(`travelmate-generation:${userId}:${hash}`); } catch { /* Storage may be unavailable. */ }
  memoryKeys.delete(`travelmate-generation:${userId}:${hash}`);
}
export async function waitForGeneration<T>(key: string, signal?: AbortSignal): Promise<T> {
  const deadline = Date.now() + 740_000;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const operation = await fetchGeneration<T>(key, signal);
    if (operation.status === 'completed' && operation.result) return operation.result;
    if (operation.status === 'failed') throw new ApiError('This generation ended without a result. Select Generate again to start a new operation.', 409, 'GENERATION_ENDED');
    await new Promise(resolve => window.setTimeout(resolve, 2500));
  }
  throw new Error('The operation is still being checked. Open My Plan to recover it; your saved plans remain available.');
}

/** Network loss never starts a new provider call or silently refunds usage. */
export async function requestGeneration<T>(url: string, payload: Record<string, unknown>, key: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(570000)]) : AbortSignal.timeout(570000) });
  } catch {
    if (signal?.aborted) throw new Error('Your generation may still be running. Open My Plan to check it before starting another.');
    return waitForGeneration<T>(key, signal);
  }
  try { return await handleResponse<T>(response); }
  catch (error) {
    announcePlanLimit(error);
    if (error instanceof ApiError && error.code === 'GENERATION_IN_PROGRESS' && error.details?.idempotencyKey === key) return waitForGeneration<T>(key, signal);
    if (response.status >= 500) return waitForGeneration<T>(key, signal);
    throw error;
  } finally { window.dispatchEvent(new Event('travelmate-plan-refresh')); }
}
