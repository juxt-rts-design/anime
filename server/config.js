const API_BASE = process.env.API_BASE || 'https://w16.french-manga.net';

async function fetchFromApi(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/json,*/*',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response;
}

export { API_BASE, fetchFromApi };
