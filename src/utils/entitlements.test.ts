import { describe, expect, it } from 'vitest';
import { computeEntitlements, extraPlansAllowed, type SubscriptionSnapshot } from './entitlements';

const sub = (over: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot => ({
  status: 'TESTE',
  expiresAt: null,
  planName: 'Teste',
  limits: { maxPlannings: 3, maxSharedMembers: 2, forsetiEnabled: true },
  ...over,
});

describe('computeEntitlements', () => {
  it('sem assinatura conhecida não limita nada', () => {
    const e = computeEntitlements(null);
    expect(e.maxPlannings).toBeNull();
    expect(e.forsetiEnabled).toBe(true);
  });

  it('aplica os limites do plano; o principal conta como um planejamento', () => {
    const e = computeEntitlements(sub());
    expect(e.maxSharedMembers).toBe(2);
    expect(extraPlansAllowed(e)).toBe(2);
  });

  it('assinatura suspensa, cancelada ou vencida não cria nada novo', () => {
    for (const s of [sub({ status: 'SUSPENSA' }), sub({ status: 'CANCELADA' }), sub({ expiresAt: '2020-01-01T00:00:00Z' })]) {
      const e = computeEntitlements(s);
      expect(e.restricted).toBe(true);
      expect(extraPlansAllowed(e)).toBe(0);
      expect(e.maxSharedMembers).toBe(0);
      expect(e.forsetiEnabled).toBe(false);
    }
  });

  it('limite zero de planejamentos ainda deixa o principal', () => {
    expect(computeEntitlements(sub({ limits: { maxPlannings: 0, maxSharedMembers: null, forsetiEnabled: true } })).maxPlannings).toBe(1);
  });
});
