import { prisma } from './db.js';

export const googleLoginStateCookie = 'revisa_google_login_state';

export function normalizedGoogleIdentity(profile) {
  const subject = String(profile?.sub || '').trim();
  const email = String(profile?.email || '').trim().toLowerCase();
  const name = String(profile?.name || email.split('@')[0] || 'Usuário').trim().slice(0, 100);
  const verified = profile?.email_verified === true || profile?.email_verified === 'true';

  if (!subject || !verified || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A Conta do Google precisa ter um e-mail verificado.');
  }
  return { subject, email, name: name.length >= 2 ? name : 'Usuário Google' };
}

export async function findOrCreateGoogleUser(profile) {
  const identity = normalizedGoogleIdentity(profile);
  const bySubject = await prisma.user.findUnique({ where: { googleSubject: identity.subject } });
  if (bySubject) return bySubject;

  const byEmail = await prisma.user.findUnique({ where: { email: identity.email } });
  if (byEmail) {
    if (byEmail.googleSubject && byEmail.googleSubject !== identity.subject) {
      throw new Error('Este e-mail já está vinculado a outra Conta do Google.');
    }
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { googleSubject: identity.subject },
    });
  }

  try {
    return await prisma.user.create({
      data: {
        name: identity.name,
        email: identity.email,
        passwordHash: null,
        googleSubject: identity.subject,
      },
    });
  } catch (failure) {
    if (failure.code !== 'P2002') throw failure;
    const raced = await prisma.user.findFirst({
      where: { OR: [{ googleSubject: identity.subject }, { email: identity.email }] },
    });
    if (!raced) throw failure;
    if (raced.googleSubject === identity.subject) return raced;
    if (!raced.googleSubject) {
      return prisma.user.update({ where: { id: raced.id }, data: { googleSubject: identity.subject } });
    }
    throw new Error('Este e-mail já está vinculado a outra Conta do Google.');
  }
}
