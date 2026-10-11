import { pool } from '@/lib/db';
import { hashPassword, verifyPassword, issueSession, removeSession } from '@/lib/auth';
import { bodyJson, error, safeMutation } from '@/lib/http';

export async function POST(request, { params }) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const { action } = await params;
  if (action === 'logout') {
    await removeSession();
    return Response.json({ ok: true });
  }
  if (action !== 'register' && action !== 'login') return error('Ação desconhecida.', 404);
  const body = await bodyJson(request);
  if (!body) return error('Dados inválidos.');
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) return error('Informe e-mail e senha válidos.');

  if (action === 'register') {
    const name = String(body.name ?? '').trim();
    if (name.length < 2 || name.length > 100 || password.length < 10 || password.length > 128) {
      return error('Informe um nome e uma senha de 10 a 128 caracteres.');
    }
    try {
      const { rows } = await pool.query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id,name,email,review_offsets AS "reviewOffsets"',
        [name, email, hashPassword(password)]
      );
      await issueSession(rows[0].id);
      return Response.json({ user: rows[0] }, { status: 201 });
    } catch (e) {
      if (e.code === '23505') return error('Este e-mail já está cadastrado.', 409);
      throw e;
    }
  }
  const { rows } = await pool.query('SELECT id,name,email,review_offsets AS "reviewOffsets",password_hash FROM users WHERE email=$1', [email]);
  if (!rows[0] || !verifyPassword(password, rows[0].password_hash)) return error('E-mail ou senha incorretos.', 401);
  await issueSession(rows[0].id);
  return Response.json({ user: { id: rows[0].id, name: rows[0].name, email: rows[0].email, reviewOffsets: rows[0].reviewOffsets } });
}
