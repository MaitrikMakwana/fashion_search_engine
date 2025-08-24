// Use same-origin by default when frontend is served by the backend build
const API_BASE = process.env.REACT_APP_API_BASE || window.location.origin;

export const getToken = (): string | null => {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
};

export const setToken = (token: string): void => {
  try {
    localStorage.setItem('token', token);
  } catch (error) {
    console.error('Failed to save token:', error);
  }
};

export const removeToken = (): void => {
  try {
    localStorage.removeItem('token');
  } catch (error) {
    console.error('Failed to remove token:', error);
  }
};

export const api = async (path: string, options: RequestInit = {}): Promise<any> => {
  const token = getToken();
  const url = `${API_BASE}${path}`;

  const headers: HeadersInit = {};

  // Set Authorization header for all requests if token exists
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser will set it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  // Read the response body only once
  const contentType = response.headers.get('content-type');
  let responseData;

  try {
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      const textData = await response.text();
      // Try to parse as JSON if possible, otherwise use as text
      try {
        responseData = JSON.parse(textData);
      } catch {
        responseData = textData;
      }
    }
  } catch (error) {
    // If we can't read the response, throw a generic error
    throw new Error(`Failed to read response: ${response.status}`);
  }

  if (!response.ok) {
    // Response body has already been read, use the parsed data
    const errorMessage = typeof responseData === 'object' && responseData?.error
      ? responseData.error
      : typeof responseData === 'string'
        ? responseData
        : `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return responseData;
};

export const ensureAuthed = (): boolean => {
  const token = getToken();
  if (!token) {
    window.location.href = '/login';
    return false;
  }
  return true;
};
