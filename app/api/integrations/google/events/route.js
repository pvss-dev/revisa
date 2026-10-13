import { authenticated, error } from '@/lib/http';
import { CalendarSyncError, listGoogleCalendarEvents } from '@/lib/google-calendar';
import { dateString } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const start = dateString(url.searchParams.get('start'), true);
  const end = dateString(url.searchParams.get('end'), true);
  if (!start || !end || end <= start) return error('Informe um período válido.');
  const rangeDays = (new Date(`${end}T00:00:00.000Z`) - new Date(`${start}T00:00:00.000Z`)) / 86_400_000;
  if (rangeDays > 62) return error('O período máximo do calendário é de 62 dias.');
  try {
    return Response.json(await listGoogleCalendarEvents(auth.user.id, start, end), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (failure) {
    return error(
      failure instanceof CalendarSyncError ? failure.message : 'Não foi possível carregar os eventos do Google Calendar.',
      failure.status || 502,
    );
  }
}
