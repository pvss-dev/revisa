import { pool } from '@/lib/db';
import { authenticated, error, integerId, safeMutation } from '@/lib/http';

export async function DELETE(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const id = integerId((await params).id);
  if (!id) return error('Prova inválida.');
  const result = await pool.query('DELETE FROM exams WHERE id=$1 AND user_id=$2', [id,auth.user.id]);
  return result.rowCount ? Response.json({ ok: true }) : error('Prova não encontrada.', 404);
}
