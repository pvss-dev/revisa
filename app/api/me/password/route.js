import { prisma } from '@/lib/db';
import { hashPassword, issueSession, verifyPassword } from '@/lib/auth';
import { authenticated, bodyJson, error, safeMutation } from '@/lib/http';

export async function PUT(request) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const { user, response } = await authenticated();
  if (response) return response;

  const body = await bodyJson(request);
  if (!body || typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') return error('Dados inválidos.');
  if (body.newPassword.length < 10 || body.newPassword.length > 128) return error('A nova senha deve ter entre 10 e 128 caracteres.');
  if (body.newPassword === body.currentPassword) return error('Escolha uma senha diferente da atual.');

  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!account || !verifyPassword(body.currentPassword, account.passwordHash)) return error('Senha atual incorreta.', 401);

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(body.newPassword) } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await issueSession(user.id);
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
