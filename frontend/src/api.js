const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export async function request(path, { token, method = 'GET', body } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(baseUrl + path, { method, headers, body: JSON.stringify(body) });
  } catch {
    throw new Error('Cannot reach the library API. Check that the backend is running.');
  }
  if (response.status === 204) return;
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message), { status: response.status });
  return data;
}
