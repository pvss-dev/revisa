import { prisma } from '@/lib/db';
import { authenticated, bodyJson, error, integerId, safeMutation } from '@/lib/http';
import { validDiscipline } from '@/lib/validation';

export async function PATCH(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const id = integerId((await params).id);
  const body = await bodyJson(request);
  const discipline = validDiscipline(body);
  if (!id || !discipline) return error('Informe um nome entre 2 e 120 caracteres.');
  const existing = await prisma.discipline.findFirst({
    where: { id, userId: auth.user.id },
    select: { id: true },
  });
  if (!existing) return error('Disciplina não encontrada.', 404);
  const duplicate = await prisma.discipline.findFirst({
    where: {
      userId: auth.user.id,
      id: { not: id },
      name: { equals: discipline.name, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (duplicate) return error('Você já cadastrou uma disciplina com este nome.', 409);
  try {
    await prisma.discipline.update({ where: { id }, data: { name: discipline.name } });
    return Response.json({ ok: true });
  } catch (failure) {
    if (failure?.code === 'P2002') return error('Você já cadastrou uma disciplina com este nome.', 409);
    throw failure;
  }
}

export async function DELETE(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const id = integerId((await params).id);
  if (!id) return error('Disciplina inválida.');
  const existing = await prisma.discipline.findFirst({
    where: { id, userId: auth.user.id },
    include: { _count: { select: { topics: true } } },
  });
  if (!existing) return error('Disciplina não encontrada.', 404);
  await prisma.discipline.delete({ where: { id: existing.id } });
  return Response.json({ ok: true, deletedTopics: existing._count.topics });
}
