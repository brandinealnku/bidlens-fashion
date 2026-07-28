const normalizeBase = (value: string) => value.trim().replace(/\/+$/, '');

export type CaptureConfig = { apiBaseUrl: string; liveCaptureEnabled: boolean; demoOnly: boolean };

export function getCaptureConfig(env: Record<string, string | boolean | undefined> = import.meta.env): CaptureConfig {
  const explicitlyEnabled = String(env.VITE_CAPTURE_ENABLED ?? 'true').toLowerCase() === 'true';
  const production = Boolean(env.PROD);
  const configuredUrl = normalizeBase(String(env.VITE_CAPTURE_API_URL || ''));
  const liveCaptureEnabled = explicitlyEnabled && (!production || Boolean(configuredUrl));
  return { apiBaseUrl: configuredUrl, liveCaptureEnabled, demoOnly: !liveCaptureEnabled };
}

export function apiUrl(path: string, config = getCaptureConfig()) {
  return `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
