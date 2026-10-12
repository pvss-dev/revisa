import { prisma } from '@/lib/db';
import { authenticated, bodyJson, error, safeMutation } from '@/lib/http';
import { validReviewOffsets } from '@/lib/validation';

export async function PATCH(request) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const body = await bodyJson(request);
  const reviewOffsets = validReviewOffsets(body?.reviewOffsets);
  if (!reviewOffsets) return error('Informe de 4 a 20 intervalos em dias, em ordem crescente, entre 1 e 3650.');
  if (reviewOffsets.length < auth.user.reviewOffsets.length) {
    const recorded = await prisma.reviewAttempt.findFirst({
      where: { userId: auth.user.id, stage: { gt: reviewOffsets.length }, topic: { reviewOffsets: { isEmpty: true } } },
      select: { id: true },
    });
    if (recorded) return error('Não é possível remover uma revisão que já tem resultados registrados.', 409);
  }
  await prisma.user.update({ where: { id: auth.user.id }, data: { reviewOffsets } });
  return Response.json({ reviewOffsets });
}
