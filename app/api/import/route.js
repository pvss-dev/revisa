import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { dateValue } from '@/lib/dates';
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
  let imported = 0;
  let skipped = 0;
  await prisma.$transaction(async tx => {
    const savedDisciplines = await tx.discipline.findMany({
      where: { userId: auth.user.id },
      select: { id: true, name: true, colorIndex: true },
    });
    const disciplinesByName = new Map(savedDisciplines.map(item => [item.name.toLocaleLowerCase('pt-BR'), item]));
    const colorCounts = Array.from({ length: 5 }, () => 0);
    savedDisciplines.forEach(item => { if (item.colorIndex >= 0 && item.colorIndex < colorCounts.length) colorCounts[item.colorIndex]++; });
    for (let row = 2; row <= sheet.rowCount; row++) {
      const subject = String(value(sheet.getCell(`A${row}`)) ?? '').trim();
      const title = String(value(sheet.getCell(`B${row}`)) ?? '').trim();
      const practiceDate = excelDate(value(sheet.getCell(`E${row}`)));
      if (!subject || !title || !practiceDate) continue;
      const lessonDate = excelDate(value(sheet.getCell(`C${row}`)));
      const rawPriority = String(value(sheet.getCell(`D${row}`)) ?? 'Média').trim();
      const priority = ['Alta','Média','Baixa'].includes(rawPriority) ? rawPriority : 'Média';
      const sourceKey = `${digest}:${row}`;
      const disciplineName = subject.slice(0, 120).replace(/\s+/g, ' ');
      const disciplineKey = disciplineName.toLocaleLowerCase('pt-BR');
      let discipline = disciplinesByName.get(disciplineKey);
      if (!discipline) {
        const colorIndex = colorCounts.indexOf(Math.min(...colorCounts));
        discipline = await tx.discipline.create({
          data: { userId: auth.user.id, name: disciplineName, colorIndex },
          select: { id: true, name: true, colorIndex: true },
        });
        colorCounts[colorIndex]++;
        disciplinesByName.set(disciplineKey, discipline);
      }
      const inserted = await tx.topic.createMany({
        data: [{ userId: auth.user.id, disciplineId: discipline.id, title: title.slice(0, 240),
          lessonDate: dateValue(lessonDate), practiceDate: dateValue(practiceDate), priority, sourceKey }],
        skipDuplicates: true,
      });
      if (!inserted.count) { skipped++; continue; }
      imported++;
      const topic = await tx.topic.findUniqueOrThrow({
        where: { userId_sourceKey: { userId: auth.user.id, sourceKey } }, select: { id: true },
      });
      const stages = [['F','G','H'],['K','L','M'],['P','Q','R'],['U','V','W'],['Z','AA','AB']];
      const attempts = [];
      for (let stage = 0; stage < 5; stage++) {
        const [flagCol,totalCol,correctCol] = stages[stage];
        const flag = Number(value(sheet.getCell(`${flagCol}${row}`)));
        const total = Number(value(sheet.getCell(`${totalCol}${row}`)));
        const correct = Number(value(sheet.getCell(`${correctCol}${row}`)));
        if (flag !== 1 || !Number.isInteger(total) || total < 1 || !Number.isInteger(correct) || correct < 0 || correct > total) continue;
        attempts.push({ userId: auth.user.id, topicId: topic.id, stage, total, correct, imported: true });
      }
      if (attempts.length) await tx.reviewAttempt.createMany({ data: attempts });
    }
  }, { timeout: 120000 });
  return Response.json({ imported, skipped });
}
