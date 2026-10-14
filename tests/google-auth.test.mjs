import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizedGoogleIdentity } from '../lib/google-auth.js';
import { googleLoginAuthorizationUrl } from '../lib/google-calendar.js';

process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'test-encryption-key-that-is-never-used-in-production';
process.env.GOOGLE_REDIRECT_URI = 'https://revisa.pvss.dev.br/api/integrations/google/callback';

test('Google login reuses the configured callback and requests only identity scopes', () => {
  const authorization = new URL(googleLoginAuthorizationUrl({
    state: 'login.test-state',
    origin: 'https://0.0.0.0:3000',
  }));
  const scopes = authorization.searchParams.get('scope').split(' ');

  assert.equal(authorization.searchParams.get('redirect_uri'), process.env.GOOGLE_REDIRECT_URI);
  assert.equal(authorization.searchParams.get('state'), 'login.test-state');
  assert.equal(authorization.searchParams.get('prompt'), 'select_account');
  assert.deepEqual(scopes.sort(), ['email', 'openid', 'profile']);
  assert.equal(scopes.includes('https://www.googleapis.com/auth/calendar.events'), false);
});

test('Google login accepts only a verified identity with a stable subject', () => {
  assert.deepEqual(normalizedGoogleIdentity({
    sub: 'google-user-123',
    email: ' User@Example.com ',
    email_verified: true,
    name: 'Paulo Vitor',
  }), {
    subject: 'google-user-123',
    email: 'user@example.com',
    name: 'Paulo Vitor',
  });

  assert.throws(() => normalizedGoogleIdentity({
    sub: 'google-user-123',
    email: 'user@example.com',
    email_verified: false,
  }), /e-mail verificado/);
});
