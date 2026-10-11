import { prisma } from '@/lib/db';
import { authenticated, error, integerId, safeMutation } from '@/lib/http';

export async function DELETE(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const id = integerId((await params).id);
  if (!id) return error('Prova inválida.');
  const result = await prisma.exam.deleteMany({ where: { id, userId: auth.user.id } });
  return result.count ? Response.json({ ok: true }) : error('Prova não encontrada.', 404);
}
