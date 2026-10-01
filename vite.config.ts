import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { fetchProduct } from './src/services/priceExtraction.ts'
import { searchProducts } from './src/services/productSearch.ts'

// Em desenvolvimento, /api/price-check roda aqui mesmo (em produção é a função da Vercel em api/)
const priceCheckDev = (): Plugin => ({
  name: 'balder-price-check-dev',
  configureServer(server) {
    server.middlewares.use('/api/price-check', async (req, res) => {
      const url = new URL(req.url || '', 'http://localhost').searchParams.get('url') || ''
      const result = await fetchProduct(url)
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(result))
    })
  },
})

// Idem para a busca de produtos por nome (api/product-search.ts)
const productSearchDev = (): Plugin => ({
  name: 'balder-product-search-dev',
  configureServer(server) {
    server.middlewares.use('/api/product-search', async (req, res) => {
      const q = new URL(req.url || '', 'http://localhost').searchParams.get('q') || ''
      const result = await searchProducts(q)
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(result))
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), priceCheckDev(), productSearchDev()],
  envPrefix: ['VITE_', 'SUPABASE_', 'NEXT_PUBLIC_'],
})
