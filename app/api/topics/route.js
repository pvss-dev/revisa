import { pool } from '@/lib/db';
import { authenticated, bodyJson, error, safeMutation } from '@/lib/http';
import { validTopic } from '@/lib/validation';

export async function GET() {
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const { rows: topics } = await pool.query(
    'SELECT id,subject,title,lesson_date AS "lessonDate",practice_date AS "practiceDate",priority,review_offsets AS "reviewOffsets",created_at AS "createdAt" FROM topics WHERE user_id=$1 ORDER BY created_at DESC,id DESC',
    [auth.user.id]
  );
  const { rows: attempts } = await pool.query(
    'SELECT topic_id AS "topicId",stage,total,correct,completed_at AS "completedAt",imported FROM review_attempts WHERE user_id=$1',
    [auth.user.id]
  );
  const byId = new Map(topics.map(t => [String(t.id), { ...t, attempts: [] }]));
  attempts.forEach(a => byId.get(String(a.topicId))?.attempts.push(a));
  return Response.json({ topics: [...byId.values()] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const body = await bodyJson(request);
  const topic = body && validTopic(body);
  if (!topic) return error('Preencha disciplina, assunto, data das questões e prioridade.');
  const { rows } = await pool.query(
    'INSERT INTO topics (user_id,subject,title,lesson_date,practice_date,priority,review_offsets) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [auth.user.id, topic.subject, topic.title, topic.lessonDate, topic.practiceDate, topic.priority, topic.reviewOffsets]
  );
  return Response.json({ id: rows[0].id }, { status: 201 });
}
