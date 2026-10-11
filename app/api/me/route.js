import { getUser } from '@/lib/auth';
export async function GET() {
  const user = await getUser();
  return Response.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
}
