import { prisma } from '@/lib/db';
import { dateValue } from '@/lib/dates';
import { authenticated, bodyJson, error, integerId, safeMutation } from '@/lib/http';
import { dateString } from '@/lib/validation';

export async function PUT(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const id = integerId((await params).id);
  const body = await bodyJson(request);
  const stage = Number(body?.stage);
  const total = Number(body?.total);
  const correct = Number(body?.correct);
  const completedAt = dateString(body?.completedAt, true);
  if (!id || !Number.isInteger(stage) || stage < 0 ||
      !Number.isInteger(total) || total < 1 || total > 10000 ||
      !Number.isInteger(correct) || correct < 0 || correct > total || !completedAt) {
    return error('Informe uma data e números válidos de questões e acertos.');
  }
  const own = await prisma.topic.findFirst({ where: { id, userId: auth.user.id }, select: { id: true, reviewOffsets: true } });
  if (!own) return error('Assunto não encontrado.', 404);
  if (stage > (own.reviewOffsets.length || auth.user.reviewOffsets.length)) return error('Revisão inválida.');
  await prisma.reviewAttempt.upsert({
    where: { topicId_stage: { topicId: id, stage } },
    create: { userId: auth.user.id, topicId: id, stage, total, correct, completedAt: dateValue(completedAt), imported: false },
    update: { total, correct, completedAt: dateValue(completedAt), imported: false },
  });
  return Response.json({ ok: true });
}

export async function DELETE(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const id = integerId((await params).id);
  const stageParam = new URL(request.url).searchParams.get('stage');
  const stage = Number(stageParam);
  if (!id || stageParam === null || !Number.isInteger(stage) || stage < 0) return error('Revisão inválida.');
  const own = await prisma.topic.findFirst({ where: { id, userId: auth.user.id }, select: { id: true, reviewOffsets: true } });
  if (!own) return error('Assunto não encontrado.', 404);
  if (stage > (own.reviewOffsets.length || auth.user.reviewOffsets.length)) return error('Revisão inválida.');
  await prisma.reviewAttempt.deleteMany({ where: { topicId: id, userId: auth.user.id, stage } });
  return Response.json({ ok: true });
}
