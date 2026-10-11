import { prisma } from '@/lib/db';
import { dateOnly, dateValue } from '@/lib/dates';
import { authenticated, bodyJson, error, safeMutation } from '@/lib/http';
import { dateString } from '@/lib/validation';

export async function GET() {
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const exams = await prisma.exam.findMany({
    where: { userId: auth.user.id }, include: { answers: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return Response.json({ exams: exams.map(e => ({ id: e.id, title: e.title,
    examDate: dateOnly(e.examDate), questionCount: e.questionCount,
    answers: e.answers.map(a => ({ examId: a.examId, questionNumber: a.questionNumber, result: a.result }))
  })) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const body = await bodyJson(request);
  const title = String(body?.title ?? '').trim();
  const examDate = dateString(body?.examDate);
  const questionCount = Number(body?.questionCount);
  if (!title || title.length > 200 || (body?.examDate && !examDate) || !Number.isInteger(questionCount) || questionCount < 1 || questionCount > 300) return error('Preencha nome e quantidade de 1 a 300 questões.');
  const exam = await prisma.exam.create({ data: {
    userId: auth.user.id, title, examDate: dateValue(examDate), questionCount,
  } });
  return Response.json({ id: exam.id }, { status: 201 });
}
