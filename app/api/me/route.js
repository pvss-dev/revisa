import { getUser, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { authenticated, bodyJson, error, safeMutation } from '@/lib/http';

export async function GET() {
  const user = await getUser();
  return Response.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const { user, response } = await authenticated();
  if (response) return response;

  const body = await bodyJson(request);
  if (!body || typeof body.name !== 'string' || typeof body.email !== 'string') return error('Dados inválidos.');
  const name = body.name.trim();
  const email = body.email.trim().toLowerCase();
  if (name.length < 2 || name.length > 100) return error('O nome deve ter entre 2 e 100 caracteres.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('Informe um e-mail válido.');
  if (email !== user.email) {
    if (typeof body.currentPassword !== 'string' || !body.currentPassword) return error('Informe sua senha atual para alterar o e-mail.');
    const account = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!account || !verifyPassword(body.currentPassword, account.passwordHash)) return error('Senha atual incorreta.', 401);
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name, email },
      select: { id: true, name: true, email: true, reviewOffsets: true },
    });
    return Response.json({ user: updated }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e.code === 'P2002') return error('Este e-mail já está cadastrado.', 409);
    throw e;
  }
}
