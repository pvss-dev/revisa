import { authenticated } from '@/lib/http';
import { calendarStatus } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await authenticated();
  if (auth.response) return auth.response;
  return Response.json(await calendarStatus(auth.user.id), { headers: { 'Cache-Control': 'no-store' } });
}
