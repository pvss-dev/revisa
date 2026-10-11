import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { pool } from '@/lib/db';
import { authenticated, error, safeMutation } from '@/lib/http';

function value(cell) {
  const raw = cell?.value;
  if (raw && typeof raw === 'object' && !(raw instanceof Date)) {
    if ('result' in raw) return raw.result;
    if ('text' in raw) return raw.text;
  }
  return raw;
}

function excelDate(raw) {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === 'number') return new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * 86400000).toISOString().slice(0, 10);
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return null;
}

export async function POST(request) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size < 1 || file.size > 5_000_000 || !file.name.toLowerCase().endsWith('.xlsx')) {
    return error('Selecione uma planilha .xlsx de até 5 MB.');
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  let workbook;
  try {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
  } catch {
    return error('Não foi possível ler esta planilha.');
  }
  const sheet = workbook.getWorksheet('CONCURSOS');
  if (!sheet || String(value(sheet.getCell('B1'))).trim() !== 'Assunto') return error('Formato da planilha de revisão não reconhecido.');
  const digest = createHash('sha256').update(buffer).digest('hex');
  const client = await pool.connect();
  let imported = 0;
  let skipped = 0;
  try {
    await client.query('BEGIN');
    for (let row = 2; row <= sheet.rowCount; row++) {
      const subject = String(value(sheet.getCell(`A${row}`)) ?? '').trim();
      const title = String(value(sheet.getCell(`B${row}`)) ?? '').trim();
      const practiceDate = excelDate(value(sheet.getCell(`E${row}`)));
      if (!subject || !title || !practiceDate) continue;
      const lessonDate = excelDate(value(sheet.getCell(`C${row}`)));
      const rawPriority = String(value(sheet.getCell(`D${row}`)) ?? 'Média').trim();
      const priority = ['Alta','Média','Baixa'].includes(rawPriority) ? rawPriority : 'Média';
      const sourceKey = `${digest}:${row}`;
      const inserted = await client.query(
        `INSERT INTO topics (user_id,subject,title,lesson_date,practice_date,priority,source_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id,source_key) DO NOTHING RETURNING id`,
        [auth.user.id,subject.slice(0,120),title.slice(0,240),lessonDate,practiceDate,priority,sourceKey]
      );
      if (!inserted.rowCount) { skipped++; continue; }
      imported++;
      const topicId = inserted.rows[0].id;
      const stages = [['F','G','H'],['K','L','M'],['P','Q','R'],['U','V','W'],['Z','AA','AB']];
      for (let stage = 0; stage < 5; stage++) {
        const [flagCol,totalCol,correctCol] = stages[stage];
        const flag = Number(value(sheet.getCell(`${flagCol}${row}`)));
        const total = Number(value(sheet.getCell(`${totalCol}${row}`)));
        const correct = Number(value(sheet.getCell(`${correctCol}${row}`)));
        if (flag !== 1 || !Number.isInteger(total) || total < 1 || !Number.isInteger(correct) || correct < 0 || correct > total) continue;
        await client.query(
          'INSERT INTO review_attempts (user_id,topic_id,stage,total,correct,imported) VALUES ($1,$2,$3,$4,$5,true)',
          [auth.user.id,topicId,stage,total,correct]
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
  return Response.json({ imported, skipped });
}
