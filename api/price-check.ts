// Função do servidor (Vercel): lê o preço de um produto a partir do link da loja.
// O navegador não consegue abrir páginas de outros sites (CORS), por isso a leitura passa por aqui.
// Devolve só os dados do produto em JSON, nunca o HTML da página.
import { fetchProduct } from '../src/services/priceExtraction.js';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url).searchParams.get('url') || '';
  const result = await fetchProduct(url);
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
