const getApiBaseUrl = () => String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, { status = null, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/** Small Fetch wrapper for future FastAPI integration; callers define endpoint paths. */
export async function apiRequest(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError('API is not configured. Set VITE_API_BASE_URL in your local environment.');
  }
  if (typeof path !== 'string' || !path.trim()) {
    throw new ApiError('An API path is required.');
  }

  const endpoint = `${baseUrl}/${path.replace(/^\/+/, '')}`;
  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const isJsonValue = Array.isArray(options.body)
    || (options.body != null && Object.getPrototypeOf(options.body) === Object.prototype);
  const body = isJsonValue
    ? JSON.stringify(options.body)
    : options.body;
  if (options.body != null && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response;
  try {
    response = await fetch(endpoint, { ...options, body, headers });
  } catch (error) {
    throw new ApiError(`Could not reach the API: ${error.message}`, { details: error });
  }

  const contentType = response.headers.get('content-type') || '';
  let payload = null;
  if (response.status !== 204) {
    let responseText;
    try {
      responseText = await response.text();
    } catch (error) {
      throw new ApiError('Could not read the API response.', { status: response.status, details: error });
    }
    if (responseText) {
      if (contentType.includes('json')) {
        try {
          payload = JSON.parse(responseText);
        } catch (error) {
          throw new ApiError('The API returned invalid JSON.', { status: response.status, details: error });
        }
      } else {
        payload = responseText;
      }
    }
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload
      ? payload.detail || payload.message || `API request failed (${response.status}).`
      : String(payload || `API request failed (${response.status}).`);
    throw new ApiError(message, { status: response.status, details: payload });
  }
  return payload;
}
