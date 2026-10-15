import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUOTA_VALID_MS, currentAiQuota, quotaNotice, readAiQuota, setAiQuota } from './forsetiAiQuota';

const headers = (remaining: string | null, limit: string | null) =>
  new Headers({ ...(remaining !== null ? { 'X-Forseti-Ai-Remaining': remaining } : {}), ...(limit !== null ? { 'X-Forseti-Ai-Limit': limit } : {}) });

afterEach(() => setAiQuota(null));

describe('readAiQuota', () => {
  it('guarda o saldo informado pelo servidor', () => {
    readAiQuota(headers('7', '30'), 1000);
    expect(currentAiQuota(1000)).toEqual({ remaining: 7, limit: 30, at: 1000 });
  });
  it('saldo zero também vale (é o aviso mais importante)', () => {
    readAiQuota(headers('0', '30'), 1000);
    expect(currentAiQuota(1000)?.remaining).toBe(0);
  });
  it.each([
    [null, '30'], ['7', null], ['abc', '30'], ['-1', '30'], ['31', '30'], ['7', '0'], ['2.5', '30'], ['', '30'],
  ])('ignora cabeçalhos estranhos (%s, %s) e mantém o saldo anterior', (remaining, limit) => {
    readAiQuota(headers('9', '30'), 1000);
    readAiQuota(headers(remaining, limit), 2000);
    expect(currentAiQuota(2000)).toEqual({ remaining: 9, limit: 30, at: 1000 });
  });
  it('o saldo vale por uma hora: depois disso o limite já voltou', () => {
    readAiQuota(headers('1', '30'), 1000);
    expect(currentAiQuota(1000 + QUOTA_VALID_MS - 1)).not.toBeNull();
    expect(currentAiQuota(1000 + QUOTA_VALID_MS)).toBeNull();
  });
});

describe('expiração', () => {
  it('o saldo some sozinho depois de uma hora', () => {
    vi.useFakeTimers();
    try {
      readAiQuota(headers('2', '30'));
      expect(currentAiQuota()).not.toBeNull();
      vi.advanceTimersByTime(QUOTA_VALID_MS + 1);
      expect(currentAiQuota()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('quotaNotice: só avisa quando já vale avisar', () => {
  const q = (remaining: number) => ({ remaining, limit: 30, at: 0 });
  it('sem medida ou com folga, não diz nada', () => {
    expect(quotaNotice(null)).toBeNull();
    expect(quotaNotice(q(30))).toBeNull();
    expect(quotaNotice(q(11))).toBeNull();
  });
  it('poucos pedidos sobrando', () => {
    expect(quotaNotice(q(10))).toBe('IA: 10 pedidos restantes nesta hora');
    expect(quotaNotice(q(1))).toBe('IA: 1 pedido restante nesta hora');
  });
  it('limite atingido', () => expect(quotaNotice(q(0))).toBe('IA: limite desta hora atingido'));
});
