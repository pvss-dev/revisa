import { authenticated, error, safeMutation } from '@/lib/http';
import { calendarStatus, retryCalendarSync } from '@/lib/google-calendar';

export async function POST(request) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const result = await retryCalendarSync(auth.user.id);
  const status = await calendarStatus(auth.user.id);
  return Response.json({ ...result, status }, { status: result.ok ? 200 : 502, headers: { 'Cache-Control': 'no-store' } });
}
