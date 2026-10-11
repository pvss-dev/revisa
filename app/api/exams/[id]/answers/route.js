import { prisma } from '@/lib/db';
import { authenticated, bodyJson, error, integerId, safeMutation } from '@/lib/http';

export async function PUT(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const id = integerId((await params).id);
  const body = await bodyJson(request);
  const number = Number(body?.questionNumber);
  const result = body?.result;
  if (!id || !Number.isInteger(number) || number < 1 || !['correct','wrong',null].includes(result)) return error('Resposta inválida.');
  const own = await prisma.exam.findFirst({ where: { id, userId: auth.user.id }, select: { questionCount: true } });
  if (!own) return error('Prova não encontrada.', 404);
  if (number > own.questionCount) return error('Questão fora da prova.');
  if (result === null) await prisma.examAnswer.deleteMany({ where: { examId: id, questionNumber: number } });
  else await prisma.examAnswer.upsert({
    where: { examId_questionNumber: { examId: id, questionNumber: number } },
    create: { examId: id, questionNumber: number, result }, update: { result },
  });
  return Response.json({ ok: true });
}
