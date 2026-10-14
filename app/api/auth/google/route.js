import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { googleLoginStateCookie } from '@/lib/google-auth';
import { CalendarSyncError, googleLoginAuthorizationUrl } from '@/lib/google-calendar';
import { error } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const state = `login.${randomBytes(32).toString('base64url')}`;
    (await cookies()).set(googleLoginStateCookie, state, {
      httpOnly: true,
      secure: new URL(request.url).protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60,
    });
    return Response.redirect(googleLoginAuthorizationUrl({
      state,
      origin: new URL(request.url).origin,
    }));
  } catch (failure) {
    return error(failure instanceof CalendarSyncError ? failure.message : 'Não foi possível iniciar o acesso pelo Google.', failure.status || 500);
  }
}
