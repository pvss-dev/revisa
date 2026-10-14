import { cookies } from 'next/headers';
import { after } from 'next/server';
import { issueSession } from '@/lib/auth';
import { findOrCreateGoogleUser, googleLoginStateCookie } from '@/lib/google-auth';
import { authenticated } from '@/lib/http';
import { exchangeGoogleCode, googleAccountEmail, googleAccountProfile, googleApplicationOrigin, saveGoogleConnection, processCalendarJob, queueFullSync } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';
const stateCookie = 'revisa_google_oauth_state';

function profileRedirect(request, result) {
  const url = new URL('/perfil', googleApplicationOrigin(request.url));
  url.searchParams.set('google', result);
  return Response.redirect(url);
}

function loginRedirect(request, result) {
  const url = new URL('/', googleApplicationOrigin(request.url));
  if (result !== 'connected') url.searchParams.set('auth', result);
  return Response.redirect(url);
}

async function completeGoogleLogin(request, url, store) {
  const expectedState = store.get(googleLoginStateCookie)?.value;
  store.delete(googleLoginStateCookie);
  if (!expectedState || url.searchParams.get('state') !== expectedState) return loginRedirect(request, 'google-invalid-state');
  if (url.searchParams.get('error')) return loginRedirect(request, 'google-denied');
  const code = url.searchParams.get('code');
  if (!code) return loginRedirect(request, 'google-failed');

  try {
    const tokens = await exchangeGoogleCode({ code, origin: url.origin });
    const profile = await googleAccountProfile(tokens.access_token);
    const user = await findOrCreateGoogleUser(profile);
    await issueSession(user.id);
    return loginRedirect(request, 'connected');
  } catch (failure) {
    console.error('Google login callback failed:', failure);
    return loginRedirect(request, 'google-failed');
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const store = await cookies();
  if (url.searchParams.get('state')?.startsWith('login.')) return completeGoogleLogin(request, url, store);

  const auth = await authenticated();
  if (auth.response) return profileRedirect(request, 'login-required');
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
