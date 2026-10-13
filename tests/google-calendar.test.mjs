import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptGoogleToken, encryptGoogleToken, googleApplicationOrigin, googleEventId, reviewEventResource } from '../lib/google-calendar.js';

process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'test-encryption-key-that-is-never-used-in-production';
process.env.GOOGLE_REDIRECT_URI = 'https://revisa.pvss.dev.br/api/integrations/google/callback';

test('OAuth callback returns to the configured public application origin', () => {
  assert.equal(googleApplicationOrigin('https://0.0.0.0:3000'), 'https://revisa.pvss.dev.br');
});

test('OAuth tokens are encrypted before persistence', () => {
  const encrypted = encryptGoogleToken('refresh-token-value');
  assert.notEqual(encrypted, 'refresh-token-value');
  assert.equal(decryptGoogleToken(encrypted), 'refresh-token-value');
});

test('Google event IDs are stable, valid and unique per review stage', () => {
  const first = googleEventId(7, 42, 1);
  assert.equal(first, googleEventId(7, 42, 1));
  assert.notEqual(first, googleEventId(7, 42, 2));
  assert.match(first, /^[0-9a-v]{5,1024}$/);
});

test('review events use exclusive end dates and the configured offsets', () => {
  const topic = {
    id: 42,
    userId: 7,
    title: 'Morfologia',
    priority: 'Média',
    practiceDate: new Date('2026-10-12T00:00:00.000Z'),
    reviewOffsets: [],
    discipline: { name: 'Português' },
  };
  const event = reviewEventResource(topic, 2, [7, 21, 60, 100]);
  assert.equal(event.date, '2026-11-02');
  assert.deepEqual(event.resource.start, { date: '2026-11-02' });
  assert.deepEqual(event.resource.end, { date: '2026-11-03' });
  assert.equal(event.resource.extendedProperties.private.revisaStage, '2');
});
