import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from './staleBundle';

describe('isChunkLoadError', () => {
  it('reconhece falhas de carregamento de página após um deploy', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/a-1.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
  });

  it('ignora erros comuns', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});
