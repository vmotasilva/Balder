import { defineConfig } from 'vitest/config'

// Avaliações que chamam a IA de verdade (gastam dinheiro): ficam fora de `npm test`. Ver evals/forseti-intent/README.md.
export default defineConfig({
  test: {
    include: ['evals/**/*.eval.ts'],
    testTimeout: 30 * 60_000,
    silent: false, // o resumo da rodada sai por console.log
  },
})
