import { getUser } from './auth';

export function error(message, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function authenticated() {
  const user = await getUser();
  return user ? { user } : { response: error('Faça login para continuar.', 401) };
}

export function safeMutation(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.get('host'); }
  catch { return false; }
}

export async function bodyJson(request) {
  if (Number(request.headers.get('content-length') || 0) > 50000) return null;
  try { return await request.json(); } catch { return null; }
}

export function integerId(value) {
  const id = Number(value);
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}
