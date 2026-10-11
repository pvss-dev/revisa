import { prisma } from '@/lib/db';
import { dateOnly, dateValue } from '@/lib/dates';
import { authenticated, bodyJson, error, safeMutation } from '@/lib/http';
import { validTopic } from '@/lib/validation';

export async function GET() {
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const topics = await prisma.topic.findMany({
    where: { userId: auth.user.id },
    include: { attempts: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return Response.json({ topics: topics.map(t => ({
    id: t.id, subject: t.subject, title: t.title, lessonDate: dateOnly(t.lessonDate),
    practiceDate: dateOnly(t.practiceDate), priority: t.priority,
    reviewOffsets: t.reviewOffsets.length ? t.reviewOffsets : null, createdAt: t.createdAt,
    attempts: t.attempts.map(a => ({ topicId: a.topicId, stage: a.stage, total: a.total,
      correct: a.correct, completedAt: dateOnly(a.completedAt), imported: a.imported })),
  })) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const body = await bodyJson(request);
  const topic = body && validTopic(body);
  if (!topic) return error('Preencha disciplina, assunto, data das questões e prioridade.');
  const created = await prisma.topic.create({ data: {
    userId: auth.user.id, subject: topic.subject, title: topic.title,
    lessonDate: dateValue(topic.lessonDate), practiceDate: dateValue(topic.practiceDate),
    priority: topic.priority, reviewOffsets: topic.reviewOffsets ?? [],
  } });
  return Response.json({ id: created.id }, { status: 201 });
}
