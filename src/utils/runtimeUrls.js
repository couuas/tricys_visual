const browserOrigin = () => {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return 'http://localhost:8000';
  }
  return window.location.origin;
};

const readSearchParam = (key) => {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    const searchParams = new URLSearchParams(window.location.search || '');
    const hash = window.location.hash || '';
    const hashQuery = hash.includes('?') ? hash.split('?')[1] : '';
    const hashParams = new URLSearchParams(hashQuery);
    return searchParams.get(key) || hashParams.get(key) || '';
  } catch (_error) {
    return '';
  }
};

const readTricysContext = () => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage?.getItem('TRICYS_CTX');
    return raw ? JSON.parse(raw) : {};
  } catch (_error) {
    return {};
  }
};

const trimTrailingSlash = (value) => value.replace(/\/$/, '');

const normalizeApiBase = (value) => {
  const normalized = trimTrailingSlash(value || '');
  if (!normalized) {
    return normalized;
  }
  if (/\/api\/v2\/goview$/i.test(normalized)) {
    return normalized.replace(/\/api\/v2\/goview$/i, '/api/v1');
  }
  if (/\/goview$/i.test(normalized)) {
    return normalized.replace(/\/goview$/i, '/api/v1');
  }
  return normalized;
};

const withDevEntryDocument = (value) => {
  try {
    const url = new URL(value);
    if (/\.html$/i.test(url.pathname)) {
      return url.toString();
    }
    url.pathname = url.pathname.endsWith('/') ? `${url.pathname}index.html` : `${url.pathname}/index.html`;
    return url.toString();
  } catch (_error) {
    return value;
  }
};

const toAbsoluteUrl = (value, fallbackPath) => {
  const raw = (value || fallbackPath || '').trim();
  if (!raw) {
    return browserOrigin();
  }
  if (/^https?:\/\//i.test(raw)) {
    return trimTrailingSlash(raw);
  }
  const normalizedPath = raw.startsWith('/') ? raw : `/${raw.replace(/^\.?\//, '')}`;
  return trimTrailingSlash(new URL(normalizedPath, `${browserOrigin()}/`).toString());
};

export const resolveApiBase = () => {
  const tricysContext = readTricysContext();
  const contextualApiBase = readSearchParam('apiBase') || tricysContext.apiBase || import.meta.env.VITE_API_URL;
  const base = normalizeApiBase(toAbsoluteUrl(contextualApiBase, '/api/v1'));
  return /\/api\/v1$/.test(base) ? base : `${base}/api/v1`;
};

export const resolveApiV2Base = () => {
  if (import.meta.env.VITE_API_V2_URL) {
    const base = toAbsoluteUrl(import.meta.env.VITE_API_V2_URL, '/api/v2/goview');
    return /\/api\/v2\/goview$/.test(base) ? base : `${base}/api/v2/goview`;
  }
  return resolveApiBase().replace(/\/api\/v1\/?$/, '/api/v2/goview');
};

export const resolveBackendBase = () => {
  return resolveApiBase().replace(/\/api\/v1\/?$/, '');
};

export const resolveGoviewBase = () => {
  const configured = (import.meta.env.VITE_GOVIEW_URL || '').trim();
  const sameOriginGoview = '/goview/';

  if (!configured) {
    return sameOriginGoview;
  }

  if (/^https?:\/\//i.test(configured)) {
    try {
      const configuredUrl = new URL(configured);
      const currentOrigin = new URL(browserOrigin());

      // In local dev, GoView runs as its own Vite app and its index.html loads
      // root-relative /src/main.ts, so it must stay on its own origin/port.
      if (import.meta.env.DEV) {
        return withDevEntryDocument(configuredUrl.toString());
      }

      const isLoopbackHost = ['localhost', '127.0.0.1'].includes(configuredUrl.hostname);

      if (isLoopbackHost) {
        const sameOriginLoopback =
          configuredUrl.protocol === currentOrigin.protocol &&
          configuredUrl.hostname === currentOrigin.hostname &&
          configuredUrl.port === currentOrigin.port;

        if (!sameOriginLoopback) {
          return sameOriginGoview;
        }
      }

      return trimTrailingSlash(configuredUrl.toString());
    } catch (error) {
      return sameOriginGoview;
    }
  }

  return toAbsoluteUrl(configured, '/goview/');
};