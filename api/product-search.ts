// Função do servidor (Vercel): busca produtos por nome nas lojas.
// O navegador não consegue abrir páginas de outros sites (CORS), por isso a busca passa por aqui.
// Exige o login do Supabase e um plano com Oportunidades (sem isso, 401 ou 403).
import { requireFeature } from './_access.js';
import { searchProducts } from '../src/services/productSearch.js';

export async function GET(request: Request): Promise<Response> {
  const access = await requireFeature(request, 'opportunitiesEnabled');
  if (access instanceof Response) return access;
  const q = new URL(request.url).searchParams.get('q') || '';
  const result = await searchProducts(q);
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
