import { authenticated, error, safeMutation } from '@/lib/http';
import { CalendarSyncError, disconnectGoogleCalendar } from '@/lib/google-calendar';

export async function DELETE(request) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  try {
    await disconnectGoogleCalendar(auth.user.id);
    return Response.json({ ok: true });
  } catch (failure) {
    console.error('Google Calendar disconnect failed:', failure);
    const message = failure instanceof CalendarSyncError
      ? failure.message
      : 'Não foi possível remover os eventos e desconectar o Google Calendar.';
    return error(message, failure.status || 502);
  }
}
