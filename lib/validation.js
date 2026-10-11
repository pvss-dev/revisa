export const priorities = ['Alta', 'Média', 'Baixa'];
export const offsets = [0, 7, 21, 60, 100];

export function validReviewOffsets(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  if (value.some(n => typeof n !== 'number' && (typeof n !== 'string' || !/^\d+$/.test(n)))) return null;
  const days = value.map(Number);
  if (days.some((n, i) => !Number.isInteger(n) || n < 1 || n > 3650 || (i > 0 && n <= days[i - 1]))) return null;
  return days;
}

export function dateString(value, required = false) {
  if ((value === null || value === undefined || value === '') && !required) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : null;
}

export function validTopic(body) {
  const subject = String(body.subject ?? '').trim();
  const title = String(body.title ?? '').trim();
  const practiceDate = dateString(body.practiceDate, true);
  const lessonDate = dateString(body.lessonDate);
  const priority = body.priority || 'Média';
  const reviewOffsets = body.reviewOffsets == null ? null : validReviewOffsets(body.reviewOffsets);
  if (!subject || subject.length > 120 || !title || title.length > 240 || !practiceDate ||
      (body.lessonDate && !lessonDate) || !priorities.includes(priority) ||
      (body.reviewOffsets != null && !reviewOffsets)) return null;
  return { subject, title, practiceDate, lessonDate, priority, reviewOffsets };
}

export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
