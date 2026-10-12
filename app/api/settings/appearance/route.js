import { prisma } from '@/lib/db';
import { authenticated, bodyJson, error, safeMutation } from '@/lib/http';
import { validAppearance } from '@/lib/appearance';

export async function PATCH(request) {
  if (!safeMutation(request)) return error('Origem inválida.', 403);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const appearance = validAppearance(await bodyJson(request));
  if (!appearance) return error('Escolha um tema válido e uma cor HEX de 3 ou 6 dígitos.');

  const user = await prisma.user.update({
    where: { id: auth.user.id },
    data: { appearanceTheme: appearance.theme, accentColor: appearance.accentColor },
    select: { appearanceTheme: true, accentColor: true },
  });
  return Response.json({ appearance: { theme: user.appearanceTheme, accentColor: user.accentColor } },
    { headers: { 'Cache-Control': 'no-store' } });
}
