import { prisma } from '@/lib/db';
import { dateValue } from '@/lib/dates';
import { authenticated, bodyJson, error, integerId, safeMutation } from '@/lib/http';
import { validTopic } from '@/lib/validation';

export async function PATCH(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const id = integerId((await params).id);
  const body = await bodyJson(request);
  const topic = body && validTopic(body);
  if (!id || !topic) return error('Dados inválidos.');
  const existing = await prisma.topic.findFirst({
    where: { id, userId: auth.user.id },
    select: { id: true, attempts: { select: { stage: true } } },
  });
  if (!existing) return error('Assunto não encontrado.', 404);
  const newStageCount = (topic.reviewOffsets ?? auth.user.reviewOffsets).length;
  if (existing.attempts.some(attempt => attempt.stage > newStageCount)) {
    return error('Não é possível remover uma revisão que já tem resultados registrados.', 409);
  }
  const result = await prisma.topic.updateMany({
    where: { id, userId: auth.user.id },
    data: { subject: topic.subject, title: topic.title, lessonDate: dateValue(topic.lessonDate),
      practiceDate: dateValue(topic.practiceDate), priority: topic.priority,
      reviewOffsets: topic.reviewOffsets ?? [], updatedAt: new Date() },
  });
  return result.count ? Response.json({ ok: true }) : error('Assunto não encontrado.', 404);
}

export async function DELETE(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const id = integerId((await params).id);
  if (!id) return error('Assunto inválido.');
  const result = await prisma.topic.deleteMany({ where: { id, userId: auth.user.id } });
  return result.count ? Response.json({ ok: true }) : error('Assunto não encontrado.', 404);
}
