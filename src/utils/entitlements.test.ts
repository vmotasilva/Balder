import { describe, expect, it } from 'vitest';
import { computeEntitlements, extraPlansAllowed, type SubscriptionSnapshot } from './entitlements';

const sub = (over: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot => ({
  status: 'TESTE',
  expiresAt: null,
  planName: 'Teste',
  startedAt: null,
  customMonthlyPriceCents: null,
  planDescription: '',
  planMonthlyPriceCents: 0,
  planBenefits: [],
  limits: { maxPlannings: 3, maxSharedMembers: 2, forsetiEnabled: true, consolidatedEnabled: true, opportunitiesEnabled: true },
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

  it('plano sem consolidado e oportunidades bloqueia os dois; assinatura restrita também', () => {
    const essencial = sub({ limits: { maxPlannings: 2, maxSharedMembers: 1, forsetiEnabled: false, consolidatedEnabled: false, opportunitiesEnabled: false } });
    const e = computeEntitlements(essencial);
    expect([e.consolidatedEnabled, e.opportunitiesEnabled, e.forsetiEnabled]).toEqual([false, false, false]);
    const r = computeEntitlements(sub({ status: 'SUSPENSA' }));
    expect([r.consolidatedEnabled, r.opportunitiesEnabled]).toEqual([false, false]);
    expect(computeEntitlements(sub()).consolidatedEnabled).toBe(true);
  });

  it('limite zero de planejamentos ainda deixa o principal', () => {
    expect(computeEntitlements(sub({ limits: { maxPlannings: 0, maxSharedMembers: null, forsetiEnabled: true, consolidatedEnabled: true, opportunitiesEnabled: true } })).maxPlannings).toBe(1);
  });
});
