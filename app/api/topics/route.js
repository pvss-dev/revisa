import { prisma } from '@/lib/db';
import { dateOnly, dateValue } from '@/lib/dates';
import { authenticated, bodyJson, error, safeMutation } from '@/lib/http';
import { validTopic } from '@/lib/validation';

function publicTopic(topic) {
  return {
    id: topic.id,
    disciplineId: topic.disciplineId,
    discipline: topic.discipline,
    subject: topic.discipline.name,
    title: topic.title,
    lessonDate: dateOnly(topic.lessonDate),
    practiceDate: dateOnly(topic.practiceDate),
    priority: topic.priority,
    reviewOffsets: topic.reviewOffsets.length ? topic.reviewOffsets : null,
    createdAt: topic.createdAt,
    attempts: topic.attempts.map(attempt => ({
      topicId: attempt.topicId,
      stage: attempt.stage,
      total: attempt.total,
      correct: attempt.correct,
      completedAt: dateOnly(attempt.completedAt),
      imported: attempt.imported,
    })),
  };
}

export async function GET() {
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const topics = await prisma.topic.findMany({
    where: { userId: auth.user.id },
    include: {
      discipline: { select: { id: true, name: true, colorIndex: true } },
      attempts: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return Response.json({ topics: topics.map(publicTopic) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const body = await bodyJson(request);
  const topic = body && validTopic(body);
  if (!topic) return error('Selecione uma disciplina e preencha assunto, data das questões e prioridade.');
  const discipline = await prisma.discipline.findFirst({
    where: { id: topic.disciplineId, userId: auth.user.id },
    select: { id: true },
  });
  if (!discipline) return error('Selecione uma disciplina válida.');
  const created = await prisma.topic.create({ data: {
    userId: auth.user.id,
    disciplineId: discipline.id,
    title: topic.title,
    lessonDate: dateValue(topic.lessonDate),
    practiceDate: dateValue(topic.practiceDate),
    priority: topic.priority,
    reviewOffsets: topic.reviewOffsets ?? [],
  } });
  return Response.json({ id: created.id }, { status: 201 });
}
