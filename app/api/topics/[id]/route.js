import { pool } from '@/lib/db';
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
  const result = await pool.query(
    'UPDATE topics SET subject=$1,title=$2,lesson_date=$3,practice_date=$4,priority=$5,review_offsets=$6,updated_at=now() WHERE id=$7 AND user_id=$8',
    [topic.subject,topic.title,topic.lessonDate,topic.practiceDate,topic.priority,topic.reviewOffsets,id,auth.user.id]
  );
  return result.rowCount ? Response.json({ ok: true }) : error('Assunto não encontrado.', 404);
}

export async function DELETE(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const id = integerId((await params).id);
  if (!id) return error('Assunto inválido.');
  const result = await pool.query('DELETE FROM topics WHERE id=$1 AND user_id=$2', [id,auth.user.id]);
  return result.rowCount ? Response.json({ ok: true }) : error('Assunto não encontrado.', 404);
}
