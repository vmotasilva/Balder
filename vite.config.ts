import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { fetchProduct } from './src/services/priceExtraction.ts'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), priceCheckDev()],
  envPrefix: ['VITE_', 'SUPABASE_', 'NEXT_PUBLIC_'],
})
