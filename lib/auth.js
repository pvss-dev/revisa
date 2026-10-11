import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { pool } from './db';

export const cookieName = 'revisa_session';
const sessionAge = 60 * 60 * 24 * 30;

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash || hash.length !== 128) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

function tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }

export async function issueSession(userId) {
  const token = randomBytes(32).toString('hex');
  await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval \'30 days\')', [tokenHash(token), userId]);
  (await cookies()).set(cookieName, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true',
    sameSite: 'lax', path: '/', maxAge: sessionAge,
  });
}

export async function getUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await pool.query(
    'SELECT u.id, u.name, u.email, u.review_offsets AS "reviewOffsets" FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now()',
    [tokenHash(token)]
  );
  return rows[0] ?? null;
}

export async function removeSession() {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(token)]);
  store.delete(cookieName);
}
