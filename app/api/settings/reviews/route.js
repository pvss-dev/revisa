import { prisma } from '@/lib/db';
import { authenticated, bodyJson, error, safeMutation } from '@/lib/http';
import { validReviewOffsets } from '@/lib/validation';

export async function PATCH(request) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const body = await bodyJson(request);
  const reviewOffsets = validReviewOffsets(body?.reviewOffsets);
  if (!reviewOffsets) return error('Informe quatro intervalos em dias, em ordem crescente, entre 1 e 3650.');
  await prisma.user.update({ where: { id: auth.user.id }, data: { reviewOffsets } });
  return Response.json({ reviewOffsets });
}
