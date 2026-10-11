import { pool } from '@/lib/db';
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
  const own = await pool.query('SELECT question_count FROM exams WHERE id=$1 AND user_id=$2', [id,auth.user.id]);
  if (!own.rowCount) return error('Prova não encontrada.', 404);
  if (number > own.rows[0].question_count) return error('Questão fora da prova.');
  if (result === null) await pool.query('DELETE FROM exam_answers WHERE exam_id=$1 AND question_number=$2', [id,number]);
  else await pool.query(
    'INSERT INTO exam_answers (exam_id,question_number,result) VALUES ($1,$2,$3) ON CONFLICT (exam_id,question_number) DO UPDATE SET result=$3',
    [id,number,result]
  );
  return Response.json({ ok: true });
}
