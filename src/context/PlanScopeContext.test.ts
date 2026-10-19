import { describe, expect, it } from 'vitest';
import { ARCHIVE_RETENTION_DAYS, archiveDaysLeft } from './PlanScopeContext';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-10-19T12:00:00Z');

describe('archiveDaysLeft', () => {
  it('arquivado agora tem os 30 dias inteiros', () => {
    expect(archiveDaysLeft({ archivedAt: new Date(now).toISOString() }, now)).toBe(ARCHIVE_RETENTION_DAYS);
  });

  it('conta os dias que faltam', () => {
    expect(archiveDaysLeft({ archivedAt: new Date(now - 10 * DAY).toISOString() }, now)).toBe(20);
  });

  it('chega a zero depois de 30 dias e não fica negativo', () => {
    expect(archiveDaysLeft({ archivedAt: new Date(now - 30 * DAY).toISOString() }, now)).toBe(0);
    expect(archiveDaysLeft({ archivedAt: new Date(now - 90 * DAY).toISOString() }, now)).toBe(0);
  });

  it('data inválida ou ausente não expira (30 dias)', () => {
    expect(archiveDaysLeft({}, now)).toBe(ARCHIVE_RETENTION_DAYS);
    expect(archiveDaysLeft({ archivedAt: 'xx' }, now)).toBe(ARCHIVE_RETENTION_DAYS);
  });
});
