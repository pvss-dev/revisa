import { prisma } from '@/lib/db';
import { dateValue } from '@/lib/dates';
import { authenticated, bodyJson, error, integerId, safeMutation } from '@/lib/http';
import { validTopic } from '@/lib/validation';
import { captureAndEnqueueEventDeletion, enqueueTopicSync, processCapturedDeletion } from '@/lib/google-calendar';

export async function PATCH(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const id = integerId((await params).id);
  const body = await bodyJson(request);
  const topic = body && validTopic(body);
  if (!id || !topic) return error('Dados inválidos.');
  const [existing, discipline] = await Promise.all([
    prisma.topic.findFirst({
      where: { id, userId: auth.user.id },
      select: { id: true, attempts: { select: { stage: true } } },
    }),
    prisma.discipline.findFirst({
      where: { id: topic.disciplineId, userId: auth.user.id },
      select: { id: true },
    }),
  ]);
  if (!existing) return error('Assunto não encontrado.', 404);
  if (!discipline) return error('Selecione uma disciplina válida.');
  const newStageCount = (topic.reviewOffsets ?? auth.user.reviewOffsets).length;
  if (existing.attempts.some(attempt => attempt.stage > newStageCount)) {
    return error('Não é possível remover uma revisão que já tem resultados registrados.', 409);
  }
  const result = await prisma.topic.updateMany({
    where: { id, userId: auth.user.id },
    data: {
      disciplineId: discipline.id,
      title: topic.title,
      lessonDate: dateValue(topic.lessonDate),
      practiceDate: dateValue(topic.practiceDate),
      priority: topic.priority,
      reviewOffsets: topic.reviewOffsets ?? [],
      updatedAt: new Date(),
    },
  });
  if (!result.count) return error('Assunto não encontrado.', 404);
  const calendarSync = await enqueueTopicSync(auth.user.id, id);
  return Response.json({ ok: true, calendarSync });
}

export async function DELETE(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const id = integerId((await params).id);
  if (!id) return error('Assunto inválido.');
  const deletion = await captureAndEnqueueEventDeletion(auth.user.id, [id]);
  const result = await prisma.topic.deleteMany({ where: { id, userId: auth.user.id } });
  if (!result.count) return error('Assunto não encontrado.', 404);
  const calendarSync = await processCapturedDeletion(deletion);
  return Response.json({ ok: true, calendarSync });
}
