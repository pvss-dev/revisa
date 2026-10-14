import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { prisma } from './db.js';
import { dateOnly, dateValue } from './dates.js';
import { addDays } from './validation.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_CALENDAR_LIST_SCOPE = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly';
const GOOGLE_LOGIN_SCOPES = ['openid', 'email', 'profile'];
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  GOOGLE_CALENDAR_LIST_SCOPE,
];

async function googleFetch(url, options = {}) {
  try {
    return await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(15_000) });
  } catch (failure) {
    if (failure instanceof CalendarSyncError) throw failure;
    throw new CalendarSyncError('O Google Calendar não respondeu a tempo. A sincronização poderá ser tentada novamente.', 504);
  }
}

export class CalendarSyncError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'CalendarSyncError';
    this.status = status;
  }
}

export function googleCalendarConfiguration() {
  const values = {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim(),
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim(),
    encryptionKey: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim(),
  };
  const missing = [];
  if (!values.clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!values.clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!values.encryptionKey) missing.push('GOOGLE_TOKEN_ENCRYPTION_KEY');
  return { ...values, configured: missing.length === 0, missing };
}

function requiredConfiguration() {
  const config = googleCalendarConfiguration();
  if (!config.configured) throw new CalendarSyncError('A integração com o Google Calendar ainda não foi configurada pelo administrador.', 503);
  return config;
}

function encryptionKey() {
  return createHash('sha256').update(requiredConfiguration().encryptionKey, 'utf8').digest();
}

export function encryptGoogleToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString('base64url')).join('.');
}

export function decryptGoogleToken(value) {
  try {
    const [iv, tag, encrypted] = String(value).split('.').map(part => Buffer.from(part, 'base64url'));
    if (!iv || !tag || !encrypted || iv.length !== 12 || tag.length !== 16) throw new Error('invalid token');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    throw new CalendarSyncError('Não foi possível ler a autorização do Google. Reconecte sua conta.', 401);
  }
}

export function googleRedirectUri(origin) {
  if (process.env.GOOGLE_REDIRECT_URI?.trim()) return process.env.GOOGLE_REDIRECT_URI.trim();
  return `${String(origin).replace(/\/$/, '')}/api/integrations/google/callback`;
}

export function googleApplicationOrigin(origin) {
  return new URL(googleRedirectUri(origin)).origin;
}

export function googleAuthorizationUrl({ state, origin, loginHint }) {
  const config = requiredConfiguration();
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: googleRedirectUri(origin),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: GOOGLE_SCOPES.join(' '),
    state,
  });
  if (loginHint) query.set('login_hint', loginHint);
  return `${GOOGLE_AUTH_URL}?${query}`;
}

export function googleLoginAuthorizationUrl({ state, origin }) {
  const config = requiredConfiguration();
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: googleRedirectUri(origin),
    response_type: 'code',
    prompt: 'select_account',
    scope: GOOGLE_LOGIN_SCOPES.join(' '),
    state,
  });
  return `${GOOGLE_AUTH_URL}?${query}`;
}

async function parseGoogleResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (response.ok) return body;
  const detail = body?.error_description || body?.error?.message || (typeof body?.error === 'string' ? body.error : null);
  const message = response.status === 401
    ? 'A autorização do Google expirou. Reconecte sua conta para continuar sincronizando.'
    : detail || 'O Google Calendar não conseguiu concluir a operação.';
  throw new CalendarSyncError(message, response.status);
}

export async function exchangeGoogleCode({ code, origin }) {
  const config = requiredConfiguration();
  const response = await googleFetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: googleRedirectUri(origin),
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  });
  return parseGoogleResponse(response);
}

export async function googleAccountProfile(accessToken) {
  const response = await googleFetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  return parseGoogleResponse(response);
}

export async function googleAccountEmail(accessToken) {
  const profile = await googleAccountProfile(accessToken);
  return profile.email || null;
}

export async function saveGoogleConnection(userId, tokens, email) {
  const existing = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  const refreshToken = tokens.refresh_token
    ? encryptGoogleToken(tokens.refresh_token)
    : existing?.refreshToken;
  if (!refreshToken) throw new CalendarSyncError('O Google não forneceu autorização para acesso contínuo. Tente conectar novamente.', 400);
  return prisma.googleCalendarConnection.upsert({
    where: { userId },
    create: {
      userId,
      googleEmail: email,
      accessToken: encryptGoogleToken(tokens.access_token),
      refreshToken,
      accessTokenExpiresAt: tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000) : null,
      scope: tokens.scope || GOOGLE_SCOPES.join(' '),
      lastSyncError: null,
    },
    update: {
      googleEmail: email,
      accessToken: encryptGoogleToken(tokens.access_token),
      refreshToken,
      accessTokenExpiresAt: tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000) : null,
      scope: tokens.scope || existing?.scope || GOOGLE_SCOPES.join(' '),
      lastSyncError: null,
    },
  });
}

async function refreshAccessToken(connection) {
  const config = requiredConfiguration();
  const response = await googleFetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: decryptGoogleToken(connection.refreshToken),
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  const tokens = await parseGoogleResponse(response);
  await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encryptGoogleToken(tokens.access_token),
      accessTokenExpiresAt: tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000) : null,
      scope: tokens.scope || connection.scope,
    },
  });
  return tokens.access_token;
}

async function accessTokenFor(userId, forceRefresh = false) {
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  if (!connection) throw new CalendarSyncError('Conecte sua conta do Google Calendar para sincronizar as revisões.', 409);
  const isFresh = connection.accessTokenExpiresAt && connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000;
  if (!forceRefresh && isFresh) return { token: decryptGoogleToken(connection.accessToken), connection };
  return { token: await refreshAccessToken(connection), connection };
}

async function googleCalendarRequest(userId, path, options = {}, retry = true) {
  let { token } = await accessTokenFor(userId);
  let response = await googleFetch(`${GOOGLE_CALENDAR_API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    cache: 'no-store',
  });
  if (response.status === 401 && retry) {
    ({ token } = await accessTokenFor(userId, true));
    response = await googleFetch(`${GOOGLE_CALENDAR_API}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      cache: 'no-store',
    });
  }
  if (response.status === 204) return null;
  return parseGoogleResponse(response);
}

export function googleEventId(userId, topicId, stage) {
  const digest = createHash('sha256').update(`revisa:${userId}:${topicId}:${stage}`).digest('hex');
  return `a${digest.slice(0, 51)}`;
}

export function reviewEventResource(topic, stage, userOffsets) {
  const offsets = topic.reviewOffsets.length ? topic.reviewOffsets : userOffsets;
  const date = stage === 0 ? dateOnly(topic.practiceDate) : addDays(dateOnly(topic.practiceDate), offsets[stage - 1]);
  const label = stage === 0 ? 'Questões iniciais' : `Revisão ${stage}`;
  return {
    date,
    resource: {
      summary: `${label}: ${topic.title}`,
      description: [
        `Disciplina: ${topic.discipline.name}`,
        `Prioridade: ${topic.priority}`,
        '',
        'Evento sincronizado automaticamente pelo Revisa.',
      ].join('\n'),
      start: { date },
      end: { date: addDays(date, 1) },
      transparency: 'transparent',
      reminders: { useDefault: true },
      extendedProperties: {
        private: {
          revisaUserId: String(topic.userId),
          revisaTopicId: String(topic.id),
          revisaStage: String(stage),
        },
      },
    },
  };
}

export function pendingReviewStages(topic, userOffsets) {
  const offsets = topic.reviewOffsets.length ? topic.reviewOffsets : userOffsets;
  const completedStages = new Set((topic.attempts || []).map(attempt => Number(attempt.stage)));
  return Array.from({ length: offsets.length + 1 }, (_, stage) => stage)
    .filter(stage => !completedStages.has(stage));
}

export function normalizeGoogleCalendarEvent(item) {
  if (!item?.id || item.status === 'cancelled' || (!item.start?.date && !item.start?.dateTime)) return null;
  const link = typeof item.htmlLink === 'string' && /^https:\/\/(?:calendar\.google\.com\/|www\.google\.com\/calendar\/)/.test(item.htmlLink)
    ? item.htmlLink
    : null;
  return {
    id: item.id,
    title: String(item.summary || 'Evento sem título').slice(0, 300),
    start: item.start.date || item.start.dateTime,
    end: item.end?.date || item.end?.dateTime || null,
    allDay: Boolean(item.start.date),
    link,
    managedByRevisa: Boolean(item.extendedProperties?.private?.revisaTopicId),
  };
}

export function hasGoogleCalendarListScope(scope) {
  return String(scope || '').split(/\s+/).includes(GOOGLE_CALENDAR_LIST_SCOPE);
}

async function listGoogleCalendars(userId) {
  const query = new URLSearchParams({
    maxResults: '250',
    minAccessRole: 'reader',
    showHidden: 'true',
  });
  const calendars = [];
  do {
    const page = await googleCalendarRequest(userId, `/users/me/calendarList?${query}`);
    calendars.push(...(page.items || []).filter(calendar => calendar?.id));
    if (page.nextPageToken) query.set('pageToken', page.nextPageToken);
    else query.delete('pageToken');
  } while (query.has('pageToken'));
  return calendars;
}

async function listCalendarEvents(userId, calendar, start, end) {
  const query = new URLSearchParams({
    timeMin: new Date(`${addDays(start, -1)}T00:00:00.000Z`).toISOString(),
    timeMax: new Date(`${addDays(end, 1)}T00:00:00.000Z`).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    showDeleted: 'false',
    maxResults: '2500',
  });
  const items = [];
  do {
    const page = await googleCalendarRequest(userId, `/calendars/${encodeURIComponent(calendar.id)}/events?${query}`);
    items.push(...(page.items || []));
    if (page.nextPageToken) query.set('pageToken', page.nextPageToken);
    else query.delete('pageToken');
  } while (query.has('pageToken'));

  const calendarName = calendar.summaryOverride || calendar.summary || 'Google Calendar';
  return items.map(item => {
    const normalized = normalizeGoogleCalendarEvent(item);
    if (!normalized) return null;
    return {
      ...normalized,
      id: `${calendar.id}:${normalized.id}`,
      calendarName,
      calendarColor: /^#[0-9a-f]{6}$/i.test(calendar.backgroundColor || '') ? calendar.backgroundColor : null,
    };
  }).filter(Boolean);
}

export async function listGoogleCalendarEvents(userId, start, end) {
  const config = googleCalendarConfiguration();
  if (!config.configured) return { configured: false, connected: false, events: [] };
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { userId }, select: { calendarId: true, scope: true } });
  if (!connection) return { configured: true, connected: false, events: [] };

  const canReadAllCalendars = hasGoogleCalendarListScope(connection.scope);
  const calendars = canReadAllCalendars
    ? await listGoogleCalendars(userId)
    : [{ id: connection.calendarId, summary: 'Google Calendar' }];
  const eventGroups = [];
  for (let index = 0; index < calendars.length; index += 6) {
    eventGroups.push(...await Promise.all(
      calendars.slice(index, index + 6).map(calendar => listCalendarEvents(userId, calendar, start, end)),
    ));
  }

  return {
    configured: true,
    connected: true,
    needsAdditionalPermission: !canReadAllCalendars,
    calendarCount: calendars.length,
    events: eventGroups.flat(),
  };
}

async function putReviewEvent(userId, calendarId, eventId, resource) {
  const calendar = encodeURIComponent(calendarId);
  const event = encodeURIComponent(eventId);
  try {
    return await googleCalendarRequest(userId, `/calendars/${calendar}/events/${event}?sendUpdates=none`, {
      method: 'PUT', body: JSON.stringify(resource),
    });
  } catch (failure) {
    if (failure.status !== 404 && failure.status !== 410) throw failure;
  }
  try {
    return await googleCalendarRequest(userId, `/calendars/${calendar}/events?sendUpdates=none`, {
      method: 'POST', body: JSON.stringify({ id: eventId, ...resource }),
    });
  } catch (failure) {
    if (failure.status !== 409) throw failure;
    return googleCalendarRequest(userId, `/calendars/${calendar}/events/${event}?sendUpdates=none`, {
      method: 'PUT', body: JSON.stringify(resource),
    });
  }
}

async function deleteRemoteEvent(userId, calendarId, eventId) {
  try {
    await googleCalendarRequest(userId, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, { method: 'DELETE' });
  } catch (failure) {
    if (failure.status !== 404 && failure.status !== 410) throw failure;
  }
}

async function syncTopic(userId, topicId) {
  const [connection, user, topic, mappings] = await Promise.all([
    prisma.googleCalendarConnection.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { reviewOffsets: true } }),
    prisma.topic.findFirst({ where: { id: topicId, userId }, include: { discipline: true, attempts: true } }),
    prisma.googleCalendarEvent.findMany({ where: { userId, topicId } }),
  ]);
  if (!connection || !user || !topic) return;
  const desiredStages = pendingReviewStages(topic, user.reviewOffsets);
  const existingByStage = new Map(mappings.map(mapping => [mapping.stage, mapping]));

  for (const stage of desiredStages) {
    const eventId = existingByStage.get(stage)?.eventId || googleEventId(userId, topic.id, stage);
    const { date, resource } = reviewEventResource(topic, stage, user.reviewOffsets);
    const event = await putReviewEvent(userId, connection.calendarId, eventId, resource);
    await prisma.googleCalendarEvent.upsert({
      where: { topicId_stage: { topicId: topic.id, stage } },
      create: { userId, topicId: topic.id, stage, eventId: event?.id || eventId, scheduledDate: dateValue(date) },
      update: { eventId: event?.id || eventId, scheduledDate: dateValue(date) },
    });
  }

  const stale = mappings.filter(mapping => !desiredStages.includes(mapping.stage));
  for (const mapping of stale) await deleteRemoteEvent(userId, connection.calendarId, mapping.eventId);
  if (stale.length) await prisma.googleCalendarEvent.deleteMany({ where: { id: { in: stale.map(mapping => mapping.id) } } });
}

async function runJob(job) {
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { userId: job.userId } });
  if (!connection) return;
  if (job.operation === 'upsert_topic') {
    await syncTopic(job.userId, job.topicId);
    return;
  }
  if (job.operation === 'delete_events') {
    const ids = Array.isArray(job.payload?.eventIds) ? [...new Set(job.payload.eventIds.filter(Boolean))] : [];
    for (const eventId of ids) await deleteRemoteEvent(job.userId, connection.calendarId, eventId);
    return;
  }
  if (job.operation === 'full_sync') {
    const topics = await prisma.topic.findMany({ where: { userId: job.userId }, select: { id: true }, orderBy: { id: 'asc' } });
    for (const topic of topics) await syncTopic(job.userId, topic.id);
  }
}

function safeSyncMessage(failure) {
  return String(failure?.message || 'Falha ao sincronizar com o Google Calendar.').slice(0, 500);
}

export async function processCalendarJob(jobId) {
  const claimed = await prisma.calendarSyncJob.updateMany({
    where: { id: jobId, status: { in: ['pending', 'failed'] } },
    data: { status: 'processing', lastError: null },
  });
  if (!claimed.count) return { ok: true, skipped: true };
  const job = await prisma.calendarSyncJob.findUnique({ where: { id: jobId } });
  if (!job) return { ok: true, skipped: true };
  try {
    await runJob(job);
    await prisma.$transaction([
      prisma.calendarSyncJob.deleteMany({ where: { id: job.id, status: 'processing' } }),
      prisma.googleCalendarConnection.updateMany({ where: { userId: job.userId }, data: { lastSyncAt: new Date(), lastSyncError: null } }),
    ]);
    return { ok: true };
  } catch (failure) {
    const message = safeSyncMessage(failure);
    const attempts = job.attempts + 1;
    const retryMinutes = Math.min(24 * 60, 5 * (2 ** Math.min(attempts - 1, 8)));
    await prisma.$transaction([
      prisma.calendarSyncJob.updateMany({
        where: { id: job.id },
        data: { status: 'failed', attempts, lastError: message, nextAttemptAt: new Date(Date.now() + retryMinutes * 60_000) },
      }),
      prisma.googleCalendarConnection.updateMany({ where: { userId: job.userId }, data: { lastSyncError: message } }),
    ]);
    return { ok: false, error: message, retryable: true };
  }
}

async function connected(userId) {
  if (!googleCalendarConfiguration().configured) return false;
  return Boolean(await prisma.googleCalendarConnection.findUnique({ where: { userId }, select: { id: true } }));
}

export async function enqueueTopicSync(userId, topicId) {
  if (!await connected(userId)) return { ok: true, skipped: true };
  const dedupeKey = `topic:${userId}:${topicId}`;
  const job = await prisma.calendarSyncJob.upsert({
    where: { dedupeKey },
    create: { userId, topicId, operation: 'upsert_topic', dedupeKey },
    update: { status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: null },
  });
  return processCalendarJob(job.id);
}

export async function enqueueFullSync(userId) {
  const queued = await queueFullSync(userId);
  return queued.jobId ? processCalendarJob(queued.jobId) : queued;
}

export async function queueFullSync(userId) {
  if (!await connected(userId)) return { ok: true, skipped: true };
  const dedupeKey = `full:${userId}`;
  const job = await prisma.calendarSyncJob.upsert({
    where: { dedupeKey },
    create: { userId, operation: 'full_sync', dedupeKey },
    update: { status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: null },
  });
  return { ok: true, queued: true, jobId: job.id };
}

export async function captureAndEnqueueEventDeletion(userId, topicIds) {
  if (!await connected(userId) || !topicIds.length) return { ok: true, skipped: true };
  const mappings = await prisma.googleCalendarEvent.findMany({
    where: { userId, topicId: { in: topicIds } },
    select: { eventId: true },
  });
  if (!mappings.length) return { ok: true, skipped: true };
  const job = await prisma.calendarSyncJob.create({
    data: {
      userId,
      operation: 'delete_events',
      dedupeKey: `delete:${userId}:${randomUUID()}`,
      payload: { eventIds: mappings.map(mapping => mapping.eventId) },
    },
  });
  return { ok: true, queued: true, jobId: job.id };
}

export async function processCapturedDeletion(result) {
  return result?.jobId ? processCalendarJob(result.jobId) : result;
}

export async function retryCalendarSync(userId) {
  if (!await connected(userId)) return { ok: true, skipped: true };
  await prisma.calendarSyncJob.updateMany({
    where: { userId, status: { in: ['pending', 'failed', 'processing'] } },
    data: { status: 'pending', nextAttemptAt: new Date(), lastError: null },
  });
  const pending = await prisma.calendarSyncJob.findMany({ where: { userId, status: 'pending' }, select: { id: true }, orderBy: { createdAt: 'asc' } });
  const results = [];
  for (const job of pending) results.push(await processCalendarJob(job.id));
  const failed = results.find(result => !result.ok);
  if (failed) return failed;
  return enqueueFullSync(userId);
}

export async function calendarStatus(userId) {
  const config = googleCalendarConfiguration();
  const [connection, pending] = await Promise.all([
    prisma.googleCalendarConnection.findUnique({ where: { userId }, select: { googleEmail: true, lastSyncAt: true, lastSyncError: true, createdAt: true, scope: true } }),
    prisma.calendarSyncJob.count({ where: { userId, status: { in: ['pending', 'failed', 'processing'] } } }),
  ]);
  return {
    configured: config.configured,
    connected: Boolean(connection),
    email: connection?.googleEmail || null,
    connectedAt: connection?.createdAt || null,
    lastSyncAt: connection?.lastSyncAt || null,
    lastError: connection?.lastSyncError || null,
    canReadAllCalendars: hasGoogleCalendarListScope(connection?.scope),
    pending,
  };
}

export async function disconnectGoogleCalendar(userId) {
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  if (!connection) return;
  const mappings = await prisma.googleCalendarEvent.findMany({ where: { userId }, select: { eventId: true } });
  for (const mapping of mappings) await deleteRemoteEvent(userId, connection.calendarId, mapping.eventId);
  const token = decryptGoogleToken(connection.accessToken);
  await googleFetch(GOOGLE_REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
    cache: 'no-store',
  }).catch(() => null);
  await prisma.$transaction([
    prisma.calendarSyncJob.deleteMany({ where: { userId } }),
    prisma.googleCalendarEvent.deleteMany({ where: { userId } }),
    prisma.googleCalendarConnection.delete({ where: { userId } }),
  ]);
}
