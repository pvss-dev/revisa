import { pool } from '@/lib/db';
import { authenticated, bodyJson, error, safeMutation } from '@/lib/http';
import { dateString } from '@/lib/validation';

export async function GET() {
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const { rows: exams } = await pool.query(
    'SELECT id,title,exam_date AS "examDate",question_count AS "questionCount" FROM exams WHERE user_id=$1 ORDER BY created_at DESC,id DESC',
    [auth.user.id]
  );
  const { rows: answers } = await pool.query(
    'SELECT a.exam_id AS "examId",a.question_number AS "questionNumber",a.result FROM exam_answers a JOIN exams e ON e.id=a.exam_id WHERE e.user_id=$1',
    [auth.user.id]
  );
  const map = new Map(exams.map(e => [String(e.id), { ...e, answers: [] }]));
  answers.forEach(a => map.get(String(a.examId))?.answers.push(a));
  return Response.json({ exams: [...map.values()] }, { headers: { 'Cache-Control': 'no-store' } });
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
  const { rows } = await pool.query(
    'INSERT INTO exams (user_id,title,exam_date,question_count) VALUES ($1,$2,$3,$4) RETURNING id',
    [auth.user.id,title,examDate,questionCount]
  );
  return Response.json({ id: rows[0].id }, { status: 201 });
}
