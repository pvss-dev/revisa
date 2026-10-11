import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword, issueSession, removeSession } from '@/lib/auth';
import { bodyJson, error, safeMutation } from '@/lib/http';

export async function POST(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const { action } = await params;
  if (action === 'logout') {
    await removeSession();
    return Response.json({ ok: true });
  }
  if (action !== 'register' && action !== 'login') return error('Ação desconhecida.', 404);
  const body = await bodyJson(request);
  if (!body) return error('Dados inválidos.');
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) return error('Informe e-mail e senha válidos.');

  if (action === 'register') {
    const name = String(body.name ?? '').trim();
    if (name.length < 2 || name.length > 100 || password.length < 10 || password.length > 128) {
      return error('Informe um nome e uma senha de 10 a 128 caracteres.');
    }
    try {
      const user = await prisma.user.create({
        data: { name, email, passwordHash: hashPassword(password) },
        select: { id: true, name: true, email: true, reviewOffsets: true },
      });
      await issueSession(user.id);
      return Response.json({ user }, { status: 201 });
    } catch (e) {
      if (e.code === 'P2002') return error('Este e-mail já está cadastrado.', 409);
      throw e;
    }
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) return error('E-mail ou senha incorretos.', 401);
  await issueSession(user.id);
  return Response.json({ user: { id: user.id, name: user.name, email: user.email, reviewOffsets: user.reviewOffsets } });
}
