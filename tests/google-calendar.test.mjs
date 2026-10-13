import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptGoogleToken, encryptGoogleToken, googleApplicationOrigin, googleEventId, hasGoogleCalendarListScope, normalizeGoogleCalendarEvent, pendingReviewStages, reviewEventResource } from '../lib/google-calendar.js';

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
  assert.equal(event.resource.description, [
    'Disciplina: Português',
    'Prioridade: Média',
    '',
    'Evento sincronizado automaticamente pelo Revisa.',
  ].join('\n'));
  assert.equal(event.resource.extendedProperties.private.revisaStage, '2');
});

test('completed review stages are removed from the Google Calendar plan', () => {
  const topic = {
    reviewOffsets: [],
    attempts: [{ stage: 0 }, { stage: 2 }],
  };
  assert.deepEqual(pendingReviewStages(topic, [7, 21, 60, 100]), [1, 3, 4]);
});

test('Google Calendar events expose only the data needed by the agenda', () => {
  assert.deepEqual(normalizeGoogleCalendarEvent({
    id: 'google-event',
    summary: 'Consulta',
    status: 'confirmed',
    start: { dateTime: '2026-10-14T09:30:00-04:00' },
    end: { dateTime: '2026-10-14T10:00:00-04:00' },
    htmlLink: 'https://www.google.com/calendar/event?eid=abc',
    extendedProperties: { private: { revisaTopicId: '42', secret: 'not-returned' } },
  }), {
    id: 'google-event',
    title: 'Consulta',
    start: '2026-10-14T09:30:00-04:00',
    end: '2026-10-14T10:00:00-04:00',
    allDay: false,
    link: 'https://www.google.com/calendar/event?eid=abc',
    managedByRevisa: true,
  });
  assert.equal(normalizeGoogleCalendarEvent({ id: 'cancelled', status: 'cancelled', start: { date: '2026-10-14' } }), null);
});

test('detects whether the account authorized access to its calendar list', () => {
  assert.equal(hasGoogleCalendarListScope('openid email https://www.googleapis.com/auth/calendar.events'), false);
  assert.equal(hasGoogleCalendarListScope('openid https://www.googleapis.com/auth/calendar.calendarlist.readonly email'), true);
});
