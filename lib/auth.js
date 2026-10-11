import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from './db';

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
  await prisma.session.create({
    data: { tokenHash: tokenHash(token), userId, expiresAt: new Date(Date.now() + sessionAge * 1000) },
  });
  (await cookies()).set(cookieName, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true',
    sameSite: 'lax', path: '/', maxAge: sessionAge,
  });
}

export async function getUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await prisma.session.findFirst({
    where: { tokenHash: tokenHash(token), expiresAt: { gt: new Date() } },
    include: { user: { select: { id: true, name: true, email: true, reviewOffsets: true } } },
  });
  return session?.user ?? null;
}

export async function removeSession() {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  store.delete(cookieName);
}
