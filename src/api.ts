import { apiUrl, getCaptureConfig } from './config';
import type { DetectedProduct, PageCaptureResult } from './types';

export type ApiErrorCode = 'API_UNAVAILABLE'|'NETWORK_ERROR'|'CAPTURE_TIMEOUT'|'INVALID_API_RESPONSE'|'INVALID_URL'|'UNSUPPORTED_DOMAIN'|'BLOCKED_DESTINATION'|'NAVIGATION_FAILED'|'AUTOMATION_BLOCKED'|'CAPTCHA_CHALLENGE'|'BROWSER_UNAVAILABLE'|'SCREENSHOT_TOO_LARGE'|'SERVER_MISCONFIGURATION'|'UNEXPECTED_CAPTURE_ERROR';
export class CaptureApiError extends Error {
  constructor(message: string, public code: ApiErrorCode, public status?: number, public guidance?: string, public details?: string) { super(message); }
}
type ErrorBody = { error?: string; code?: ApiErrorCode; guidance?: string };

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  if (!raw) throw new CaptureApiError(`The capture service returned an empty response${response.status ? ` (HTTP ${response.status})` : ''}.`, 'INVALID_API_RESPONSE', response.status);
  if (!isJson) throw new CaptureApiError(`The capture service returned a non-JSON response (HTTP ${response.status}).`, 'INVALID_API_RESPONSE', response.status);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new CaptureApiError(`The capture service returned invalid JSON (HTTP ${response.status}).`, 'INVALID_API_RESPONSE', response.status); }
  if (!response.ok) {
    const body = parsed && typeof parsed === 'object' ? parsed as ErrorBody : {};
    throw new CaptureApiError(body.error || `The capture service rejected the request (HTTP ${response.status}).`, body.code || (response.status === 503 ? 'API_UNAVAILABLE' : 'UNEXPECTED_CAPTURE_ERROR'), response.status, body.guidance);
  }
  return parsed as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try { return await parseApiResponse<T>(await fetch(apiUrl(path), init)); }
  catch (error) {
    if (error instanceof CaptureApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new CaptureApiError('The capture request timed out.', 'CAPTURE_TIMEOUT');
    throw new CaptureApiError('Could not connect to the capture service.', 'NETWORK_ERROR', undefined, 'Check that npm run dev is running, or use Demo Mode.', error instanceof Error ? error.message : undefined);
  }
}

export async function captureAuction(url: string, signal?: AbortSignal) {
  if (!getCaptureConfig().liveCaptureEnabled) throw new CaptureApiError('Live page capture is unavailable in this static deployment.', 'API_UNAVAILABLE', undefined, 'Use Demo Mode or connect a capture API.');
  return request<{capture: PageCaptureResult; products: DetectedProduct[]; warnings?: unknown[]}>('/api/capture', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({url}), signal });
}
export const checkCaptureHealth = () => request<{status:string;playwright:string}>('/api/health');
