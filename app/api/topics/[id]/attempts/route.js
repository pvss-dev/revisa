import { pool } from '@/lib/db';
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
  if (!id || !Number.isInteger(stage) || stage < 0 || stage > 4 ||
      !Number.isInteger(total) || total < 1 || total > 10000 ||
      !Number.isInteger(correct) || correct < 0 || correct > total || !completedAt) {
    return error('Informe uma data e números válidos de questões e acertos.');
  }
  const own = await pool.query('SELECT 1 FROM topics WHERE id=$1 AND user_id=$2', [id,auth.user.id]);
  if (!own.rowCount) return error('Assunto não encontrado.', 404);
  await pool.query(
    `INSERT INTO review_attempts (user_id,topic_id,stage,total,correct,completed_at,imported)
     VALUES ($1,$2,$3,$4,$5,$6,false)
     ON CONFLICT (topic_id,stage) DO UPDATE SET total=$4,correct=$5,completed_at=$6,imported=false`,
    [auth.user.id,id,stage,total,correct,completedAt]
  );
  return Response.json({ ok: true });
}

export async function DELETE(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const id = integerId((await params).id);
  const stage = Number(new URL(request.url).searchParams.get('stage'));
  if (!id || !Number.isInteger(stage) || stage < 0 || stage > 4) return error('Revisão inválida.');
  await pool.query('DELETE FROM review_attempts WHERE topic_id=$1 AND user_id=$2 AND stage=$3', [id,auth.user.id,stage]);
  return Response.json({ ok: true });
}
