import { cookies } from 'next/headers';
import { after } from 'next/server';
import { authenticated } from '@/lib/http';
import { exchangeGoogleCode, googleAccountEmail, saveGoogleConnection, processCalendarJob, queueFullSync } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';
const stateCookie = 'revisa_google_oauth_state';

function profileRedirect(request, result) {
  const url = new URL('/perfil', request.url);
  url.searchParams.set('google', result);
  return Response.redirect(url);
}

export async function GET(request) {
  const auth = await authenticated();
  if (auth.response) return profileRedirect(request, 'login-required');
  const url = new URL(request.url);
  const store = await cookies();
  const expectedState = store.get(stateCookie)?.value;
  store.delete(stateCookie);
  if (!expectedState || url.searchParams.get('state') !== expectedState) return profileRedirect(request, 'invalid-state');
  if (url.searchParams.get('error')) return profileRedirect(request, 'denied');
  const code = url.searchParams.get('code');
  if (!code) return profileRedirect(request, 'failed');
  try {
    const tokens = await exchangeGoogleCode({ code, origin: url.origin });
    const email = await googleAccountEmail(tokens.access_token);
    await saveGoogleConnection(auth.user.id, tokens, email);
    const sync = await queueFullSync(auth.user.id);
    if (sync.jobId) after(() => processCalendarJob(sync.jobId));
    return profileRedirect(request, 'connected');
  } catch (failure) {
    console.error('Google Calendar OAuth callback failed:', failure);
    return profileRedirect(request, 'failed');
  }
}
