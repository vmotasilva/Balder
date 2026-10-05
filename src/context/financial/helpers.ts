import { type DataFormatCategory, type Movement, type MovementType } from '../../types';

export const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

// Salário previsto gerado automaticamente pelo antigo passo "Salário & Renda" do onboarding
// (título "Salário: <empregador>"). Contas a receber agora contém apenas o que o usuário lança.
export const isLegacyOnboardingSalary = (m: Movement) =>
  m.type === 'RECEBER' &&
  m.category === 'Salário' &&
  m.status === 'PREVISTA' &&
  m.title.startsWith('Salário: ');

// ── Formatar Dados ───────────────────────────────────────────────────────────
// Grupo de formatação ao qual uma movimentação pertence
export const movementFormatCategory = (type: MovementType): DataFormatCategory =>
  type === 'CARTAO' ? 'FATURAS' : type === 'EMPRESTIMO' ? 'EMPRESTIMOS' : 'MOVIMENTACOES';

// Após uma formatação, caches locais só podem restaurar itens criados DEPOIS dela.
// Os ids locais carregam o timestamp de criação (ex.: mov_1727391234567, cp_1727391234567).
export const survivesFormat = (id: string, formattedAtIso?: string) => {
  if (!formattedAtIso) return true;
  const ts = Number(String(id).split('_')[1]);
  return Number.isFinite(ts) && ts > Date.parse(formattedAtIso);
};
