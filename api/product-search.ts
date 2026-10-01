// Função do servidor (Vercel): busca produtos por nome nas lojas.
// O navegador não consegue abrir páginas de outros sites (CORS), por isso a busca passa por aqui.
import { searchProducts } from '../src/services/productSearch.js';

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams.get('q') || '';
  const result = await searchProducts(q);
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
