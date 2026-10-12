import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { authenticated, error } from '@/lib/http';
import { CalendarSyncError, googleAuthorizationUrl } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';
const stateCookie = 'revisa_google_oauth_state';

export async function GET(request) {
  const auth = await authenticated();
  if (auth.response) return auth.response;
  try {
    const state = randomBytes(32).toString('base64url');
    (await cookies()).set(stateCookie, state, {
      httpOnly: true,
      secure: new URL(request.url).protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60,
    });
    const authorizationUrl = googleAuthorizationUrl({
      state,
      origin: new URL(request.url).origin,
      loginHint: auth.user.email,
    });
    return Response.redirect(authorizationUrl);
  } catch (failure) {
    return error(failure instanceof CalendarSyncError ? failure.message : 'Não foi possível iniciar a conexão com o Google.', failure.status || 500);
  }
}
