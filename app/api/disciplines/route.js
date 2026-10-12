import { prisma } from '@/lib/db';
import { authenticated, bodyJson, error, safeMutation } from '@/lib/http';
import { validDiscipline } from '@/lib/validation';

function publicDiscipline(discipline) {
  return {
    id: discipline.id,
    name: discipline.name,
    colorIndex: discipline.colorIndex,
    topicCount: discipline._count?.topics ?? 0,
  };
}

export async function GET() {
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const disciplines = await prisma.discipline.findMany({
    where: { userId: auth.user.id },
    include: { _count: { select: { topics: true } } },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  return Response.json({ disciplines: disciplines.map(publicDiscipline) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const body = await bodyJson(request);
  const discipline = validDiscipline(body);
  if (!discipline) return error('Informe um nome entre 2 e 120 caracteres.');
  const duplicate = await prisma.discipline.findFirst({
    where: { userId: auth.user.id, name: { equals: discipline.name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (duplicate) return error('Você já cadastrou uma disciplina com este nome.', 409);
  const usage = await prisma.discipline.groupBy({
    by: ['colorIndex'],
    where: { userId: auth.user.id },
    _count: { _all: true },
  });
  const counts = Array.from({ length: 5 }, () => 0);
  usage.forEach(item => { if (item.colorIndex >= 0 && item.colorIndex < counts.length) counts[item.colorIndex] = item._count._all; });
  const colorIndex = counts.indexOf(Math.min(...counts));
  try {
    const created = await prisma.discipline.create({
      data: { userId: auth.user.id, name: discipline.name, colorIndex },
      include: { _count: { select: { topics: true } } },
    });
    return Response.json({ discipline: publicDiscipline(created) }, { status: 201 });
  } catch (failure) {
    if (failure?.code === 'P2002') return error('Você já cadastrou uma disciplina com este nome.', 409);
    throw failure;
  }
}
