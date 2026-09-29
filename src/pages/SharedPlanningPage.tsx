import React, { useState } from 'react';
import { AccountSharingPanel } from '../components/AccountSharingPanel';
import { useAccountScope } from '../context/AccountScopeContext';
import { DecimalInput } from '../components/DecimalInput';
import { parseMoney } from '../utils/parseDecimal';
import { useFinancial } from '../context/FinancialContext';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  UserCheck,
  HeartHandshake,
  Star,
  Copy,
  Check,
  Plus,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  Receipt,
  History,
  Trash2,
} from 'lucide-react';
import type { ExpenseSplitMode, SharedSplitRule } from '../types';
import {
  SPLIT_MODE_LABEL,
  competenceLabel,
  competenceOf,
  currentCompetence,
  owesFor,
  pctLabel,
  ruleFor,
  sortedRules,
  splitFor,
} from '../utils/sharedSplit';
import { InfoButton } from '../components/InfoButton';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const SharedPlanningPage: React.FC = () => {
  const { user } = useAuth();
  const {
    activeTrackingScope,
    defaultTrackingScope,
    setActiveTrackingScope,
    setDefaultTrackingScope,
    sharedScenario,
    updateSharedScenario,
    setSharedSplitRules,
    sharedSettlements,
    addSharedSettlement,
    toggleSharedSettlementStatus,
    settleAllSharedDebts,
    } = useFinancial();

  const [copiedInvite, setCopiedInvite] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('Alimentação');
  const [newExpensePaidBy, setNewExpensePaidBy] = useState<'USER' | 'PARTNER'>('USER');

  // Sem parceiro(a) conectado não há nada compartilhado para mostrar
  const partner = sharedScenario?.members?.find((m) => m.role === 'PARTNER');
  const ownerMember = sharedScenario?.members?.find((m) => m.role === 'OWNER');
  const hasPartner = !!partner;
  const { viewing } = useAccountScope();
  const ownerName = ownerMember?.name || user?.name || 'Titular';
  const ownerEmail = ownerMember?.email || user?.email || '';
  const partnerName = partner?.name || 'Parceiro(a)';
  const firstName = (name: string) => name.split(' ')[0] || name;
  const initials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();

  const setMemberIncome = (role: 'OWNER' | 'PARTNER', income: number) => {
    if (!sharedScenario) return;
    updateSharedScenario({
      members: sharedScenario.members.map((m) => (m.role === role ? { ...m, monthlyIncome: income } : m)),
    });
  };

  // Rendas (usadas no modo proporcional à renda; sem rendas informadas, divide meio a meio)
  const userSalary = ownerMember?.monthlyIncome ?? 0;
  const partnerSalary = partner?.monthlyIncome ?? 0;
  const totalHouseholdIncome = userSalary + partnerSalary;
  const proportionalUserPct = totalHouseholdIncome > 0 ? Math.round((userSalary / totalHouseholdIncome) * 100) : 50;
  const proportionalPartnerPct = 100 - proportionalUserPct;

  // Divisão que vale na competência atual (histórico de contribuições por competência)
  const nowCompetence = currentCompetence();
  const currentSplit = splitFor(sharedScenario, nowCompetence);
  const currentSplitMode = currentSplit.mode;
  const currentRule = ruleFor(sharedScenario, nowCompetence);
  const ownerContribution = currentRule?.contributions.OWNER ?? 0;
  const partnerContribution = currentRule?.contributions.PARTNER ?? 0;
  const contributionTotal = ownerContribution + partnerContribution;
  const contributionUserPct = contributionTotal > 0 ? Math.round((ownerContribution / contributionTotal) * 100) : 50;
  const rules = sortedRules(sharedScenario);

  // Cálculos de Acerto do Mês (cada despesa já traz a cota da regra da sua competência)
  const pendingSettlements = sharedSettlements.filter((s) => s.status === 'PENDENTE');
  const totalSharedExpenses = pendingSettlements.reduce((acc, s) => acc + s.totalAmount, 0);

  const totalPaidByUser = pendingSettlements
    .filter((s) => s.paidBy === 'USER')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const totalPaidByPartner = pendingSettlements
    .filter((s) => s.paidBy === 'PARTNER')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const userFairShare = pendingSettlements.reduce((acc, s) => acc + s.userOwes, 0);
  const partnerFairShare = pendingSettlements.reduce((acc, s) => acc + s.partnerOwes, 0);

  // Formulário de mudança de contribuição (em branco = mantém os valores vigentes)
  const [formCompetence, setFormCompetence] = useState(nowCompetence);
  const [formOwner, setFormOwner] = useState<number | null>(null);
  const [formPartner, setFormPartner] = useState<number | null>(null);
  const formOwnerValue = formOwner ?? ownerContribution;
  const formPartnerValue = formPartner ?? partnerContribution;
  const formTotal = formOwnerValue + formPartnerValue;
  const formOwnerShare = formTotal > 0 ? formOwnerValue / formTotal : 0.5;

  /** Inclui ou substitui a regra de uma competência e recalcula os pendentes dali em diante. */
  const saveRule = (rule: Omit<SharedSplitRule, 'id' | 'createdAt'>) => {
    const others = rules.filter((r) => r.effectiveFrom !== rule.effectiveFrom);
    const next: SharedSplitRule[] = [
      ...others,
      { ...rule, id: `split_${Date.now()}`, createdAt: new Date().toISOString() },
    ].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    setSharedSplitRules(next, rule.effectiveFrom);
  };

  const handleSaveContribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCompetence) return;
    saveRule({
      effectiveFrom: formCompetence,
      splitMode: 'CONTRIBUTION',
      contributions: { OWNER: formOwnerValue, PARTNER: formPartnerValue },
    });
    setFormOwner(null);
    setFormPartner(null);
  };

  const handleRemoveRule = (rule: SharedSplitRule) => {
    setSharedSplitRules(
      rules.filter((r) => r.id !== rule.id),
      rule.effectiveFrom
    );
  };

  // Diferença: se positivo, usuário pagou mais que sua cota (parceiro deve transferir ao usuário)
  const netBalance = totalPaidByUser - userFairShare;

  const handleCopyInvite = () => {
    const inviteText = `https://balder.app/join?code=${sharedScenario?.inviteCode || 'BALDER-CASAL-7829'}`;
    navigator.clipboard.writeText(inviteText);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  // Trocar o modelo vale a partir da competência atual (entra no histórico)
  const handleToggleSplitMode = (mode: ExpenseSplitMode) => {
    if (!sharedScenario || mode === currentSplitMode) return;
    saveRule({
      effectiveFrom: nowCompetence,
      splitMode: mode,
      contributions: { OWNER: ownerContribution, PARTNER: partnerContribution },
    });
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseMoney(newExpenseAmount);
    if (!newExpenseTitle.trim() || amountNum <= 0) return;

    const date = new Date().toISOString().split('T')[0];
    const competence = competenceOf(date);

    addSharedSettlement({
      title: newExpenseTitle.trim(),
      category: newExpenseCategory,
      totalAmount: amountNum,
      paidBy: newExpensePaidBy,
      ...owesFor(sharedScenario, amountNum, competence),
      date,
      competence,
      status: 'PENDENTE',
    });

    setNewExpenseTitle('');
    setNewExpenseAmount('');
    setIsAddExpenseOpen(false);
  };

  return (
    <div className="page-container animate-fade-in shared-planning-container">
      {/* Header da Página */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="badge badge-purple flex items-center gap-1.5">
              <HeartHandshake size={13} className="text-pink-400" />
              <span>ACOMPANHAMENTO MÚTUO</span>
            </span>
            <span className="text-xs text-muted">Planejamento a Dois & Familiar</span>
          </div>
          <h1 className="page-title label-with-info">
            Planejamento Compartilhado
            <InfoButton title="Planejamento Compartilhado">
              <p>Acompanhe o orçamento conjunto, divisão inteligente de despesas e metas em comum</p>
            </InfoButton>
          </h1>
        </div>

        {hasPartner && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary flex items-center gap-2"
            onClick={handleCopyInvite}
            title="Copiar link de convite para seu parceiro(a)"
          >
            {copiedInvite ? (
              <>
                <Check size={16} className="text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Link Copiado!</span>
              </>
            ) : (
              <>
                <Copy size={16} className="text-cyan-400" />
                <span>Convidar Parceiro(a)</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn-primary flex items-center gap-2"
            onClick={() => setIsAddExpenseOpen(true)}
          >
            <Plus size={16} />
            <span>Nova Despesa Conjunta</span>
          </button>
        </div>
        )}
      </div>

      {!viewing && <AccountSharingPanel />}

      {/* ============================================================== */}
      {/* CARD 1: DEFINIÇÃO DO ACOMPANHAMENTO PRINCIPAL                    */}
      {/* ============================================================== */}
      <section className="glass-card shared-scope-card p-5 mb-6 border border-cyan-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-400">
              <Star size={20} className="fill-amber-400 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Qual é o seu Acompanhamento Principal?</h3>
                <span className="badge badge-amber text-[10px] uppercase font-bold">Visão Padrão</span>
              </div>
              <p className="text-xs text-muted mt-1 max-w-2xl leading-relaxed">
                Defina se a visualização padrão ao abrir o Dashboard e a plataforma foca no seu{' '}
                <strong>Acompanhamento Próprio (Individual)</strong> ou no{' '}
                <strong>Acompanhamento Compartilhado (Conjunto)</strong>. Você pode alternar a qualquer momento.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Opção 1: Individual */}
            <button
              type="button"
              className={`scope-select-btn ${defaultTrackingScope === 'INDIVIDUAL' ? 'active' : ''}`}
              onClick={() => {
                setDefaultTrackingScope('INDIVIDUAL');
                setActiveTrackingScope('INDIVIDUAL');
              }}
              title="Definir Acompanhamento Próprio como padrão principal"
            >
              <div className="flex items-center gap-2">
                <UserCheck size={16} className={defaultTrackingScope === 'INDIVIDUAL' ? 'text-cyan-400' : 'text-muted'} />
                <div className="text-left">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>Próprio (Individual)</span>
                    {defaultTrackingScope === 'INDIVIDUAL' && (
                      <span className="badge badge-cyan text-[9px] px-1 py-0.2">Principal</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted block">Minhas contas e metas</span>
                </div>
              </div>
            </button>

            {/* Opção 2: Compartilhado */}
            <button
              type="button"
              className={`scope-select-btn ${defaultTrackingScope === 'COMPARTILHADO' ? 'active' : ''}`}
              onClick={() => {
                setDefaultTrackingScope('COMPARTILHADO');
                setActiveTrackingScope('COMPARTILHADO');
              }}
              title="Definir Acompanhamento Compartilhado como padrão principal"
            >
              <div className="flex items-center gap-2">
                <Users size={16} className={defaultTrackingScope === 'COMPARTILHADO' ? 'text-pink-400' : 'text-muted'} />
                <div className="text-left">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>Compartilhado</span>
                    {defaultTrackingScope === 'COMPARTILHADO' && (
                      <span className="badge badge-purple text-[9px] px-1 py-0.2">Principal</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted block">Orçamento mútuo do casal</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Status da Visão Ativa no Momento */}
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted">Visualização ativa no momento:</span>
            <span className={`font-semibold ${activeTrackingScope === 'COMPARTILHADO' ? 'text-pink-400' : 'text-cyan-400'}`}>
              {activeTrackingScope === 'COMPARTILHADO' ? '👥 Acompanhamento Compartilhado (Conjunto)' : '👤 Acompanhamento Próprio (Individual)'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Sincronizado & Auditado pela Forseti IA</span>
          </div>
        </div>
      </section>

      {!hasPartner ? (
        <section className="glass-card shared-empty-state">
          <HeartHandshake size={32} className="text-pink-400" />
          <h3>Nada compartilhado por enquanto</h3>
          <p>
            Você ainda não compartilhou seu planejamento com ninguém. Quando houver alguém conectado, aparecem aqui o
            acerto do mês, as despesas conjuntas e as metas em comum.
          </p>
        </section>
      ) : (
      <>
      {/* ============================================================== */}
      {/* GRID DE MEMBROS & PARCERIA CONECTADA                            */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Membro 1: Você */}
        <div className="glass-card p-4 border border-cyan-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center font-bold text-cyan-300">
                {initials(ownerName)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white">{ownerName}</h4>
                  <span className="badge badge-cyan text-[9px]">Titular</span>
                </div>
                <span className="text-xs text-muted">{ownerEmail}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted block">Renda Líquida</span>
              {viewing ? (
                <span className="font-bold text-sm text-cyan-300">
                  {userSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              ) : (
                <DecimalInput
                  className="form-input form-input-sm shared-income-input"
                  value={userSalary}
                  emptyWhenZero
                  placeholder="Informe"
                  onValueChange={(v) => setMemberIncome('OWNER', v)}
                />
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs bg-white/5 rounded-lg p-2.5">
            <span className="text-muted">
              {currentSplitMode === 'CONTRIBUTION' ? `Contribui ${formatBRL(ownerContribution)}/mês · cota:` : 'Cota de Rateio Calculada:'}
            </span>
            <span className="font-bold text-cyan-400">{pctLabel(currentSplit.ownerShare)} das despesas</span>
          </div>
        </div>

        {/* Membro 2: Parceiro(a) */}
        <div className="glass-card p-4 border border-pink-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-500/20 border border-pink-500/40 flex items-center justify-center font-bold text-pink-300">
                {initials(partnerName)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white">{partnerName}</h4>
                  <span className="badge badge-purple text-[9px]">Conectada</span>
                </div>
                <span className="text-xs text-muted">{partner?.email}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted block">Renda Estimada</span>
              {viewing ? (
                <span className="font-bold text-sm text-pink-300">
                  {partnerSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              ) : (
                <DecimalInput
                  className="form-input form-input-sm shared-income-input"
                  value={partnerSalary}
                  emptyWhenZero
                  placeholder="Informe"
                  onValueChange={(v) => setMemberIncome('PARTNER', v)}
                />
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs bg-white/5 rounded-lg p-2.5">
            <span className="text-muted">
              {currentSplitMode === 'CONTRIBUTION' ? `Contribui ${formatBRL(partnerContribution)}/mês · cota:` : 'Cota de Rateio Calculada:'}
            </span>
            <span className="font-bold text-pink-400">{pctLabel(currentSplit.partnerShare)} das despesas</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* CONTRIBUIÇÃO DE CADA UM, COM VIGÊNCIA POR COMPETÊNCIA           */}
      {/* ============================================================== */}
      <section className="glass-card p-5 mb-6 shared-contribution">
        <div className="shared-contribution-head">
          <div>
            <div className="flex items-center gap-2">
              <History size={18} className="text-cyan-400" />
              <h3 className="font-bold text-base text-white">Contribuição de cada um</h3>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Informe quanto cada pessoa contribui por mês: a divisão das despesas sai da proporção entre os valores
              (pode ser 100% de um lado). Cada mudança vale a partir da competência escolhida.
            </p>
          </div>
          <span className="shared-contribution-now">
            Vigente em {competenceLabel(nowCompetence)}: <strong>{SPLIT_MODE_LABEL[currentSplitMode]}</strong> ·{' '}
            {firstName(ownerName)} {pctLabel(currentSplit.ownerShare)} · {firstName(partnerName)}{' '}
            {pctLabel(currentSplit.partnerShare)}
          </span>
        </div>

        {!viewing && (
          <form className="shared-contribution-form" onSubmit={handleSaveContribution}>
            <label>
              <span>A partir de</span>
              <input
                type="month"
                className="form-input form-input-sm"
                value={formCompetence}
                onChange={(e) => setFormCompetence(e.target.value)}
                required
              />
            </label>
            <label>
              <span>{firstName(ownerName)} contribui (R$/mês)</span>
              <DecimalInput className="form-input form-input-sm" value={formOwnerValue} onValueChange={(v) => setFormOwner(v)} />
            </label>
            <label>
              <span>{firstName(partnerName)} contribui (R$/mês)</span>
              <DecimalInput className="form-input form-input-sm" value={formPartnerValue} onValueChange={(v) => setFormPartner(v)} />
            </label>
            <div className="shared-contribution-preview">
              <span>Divisão calculada</span>
              <strong>
                {pctLabel(formOwnerShare)} / {pctLabel(1 - formOwnerShare)}
              </strong>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">
              Registrar a partir de {formCompetence ? competenceLabel(formCompetence) : '—'}
            </button>
          </form>
        )}

        {rules.length === 0 ? (
          <p className="text-xs text-muted mt-3">
            Nenhuma mudança registrada ainda: vale {SPLIT_MODE_LABEL[currentSplitMode].toLowerCase()} para todas as
            competências.
          </p>
        ) : (
          <ul className="shared-contribution-history">
            {[...rules].reverse().map((rule) => {
              const split = splitFor(sharedScenario ? { ...sharedScenario, splitHistory: [rule] } : null, rule.effectiveFrom);
              const status =
                rule.effectiveFrom > nowCompetence ? 'Agendada' : rule.id === currentRule?.id ? 'Vigente' : 'Anterior';
              return (
                <li key={rule.id} className={`is-${status.toLowerCase()}`}>
                  <div>
                    <strong>A partir de {competenceLabel(rule.effectiveFrom)}</strong>
                    <span className="shared-contribution-status">{status}</span>
                    <small>
                      {SPLIT_MODE_LABEL[rule.splitMode]}
                      {rule.splitMode === 'CONTRIBUTION' &&
                        ` · ${firstName(ownerName)} ${formatBRL(rule.contributions.OWNER)} · ${firstName(partnerName)} ${formatBRL(
                          rule.contributions.PARTNER
                        )}`}
                      {' → '}
                      {pctLabel(split.ownerShare)} / {pctLabel(split.partnerShare)}
                    </small>
                  </div>
                  {!viewing && (
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => handleRemoveRule(rule)}
                      title="Remover esta mudança (as despesas pendentes são recalculadas)"
                      aria-label={`Remover a mudança de ${competenceLabel(rule.effectiveFrom)}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ============================================================== */}
      {/* SEÇÃO 3: ACERTO MÚTUO ("QUEM DEVE QUANTO A QUEM") & RATEIO     */}
      {/* ============================================================== */}
      <section className="glass-card p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-3 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2">
              <Calculator size={18} className="text-amber-400" />
              <h3 className="font-bold text-base text-white">Acerto do Mês & Regra de Divisão</h3>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Cálculo contábil automático de compensação de despesas conjuntas pagas no mês
            </p>
          </div>

          {/* Toggle de Modelo de Divisão */}
          <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-xl border border-white/10 flex-wrap">
            <button
              type="button"
              disabled={!!viewing}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${currentSplitMode === 'CONTRIBUTION' ? 'bg-indigo-600 text-white shadow' : 'text-muted hover:text-white'}`}
              onClick={() => handleToggleSplitMode('CONTRIBUTION')}
            >
              Por contribuição ({contributionUserPct}/{100 - contributionUserPct})
            </button>
            <button
              type="button"
              disabled={!!viewing}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${currentSplitMode === 'PROPORTIONAL_INCOME' ? 'bg-indigo-600 text-white shadow' : 'text-muted hover:text-white'}`}
              onClick={() => handleToggleSplitMode('PROPORTIONAL_INCOME')}
            >
              Proporcional à Renda ({proportionalUserPct}/{proportionalPartnerPct})
            </button>
            <button
              type="button"
              disabled={!!viewing}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${currentSplitMode === 'EQUAL_50_50' ? 'bg-indigo-600 text-white shadow' : 'text-muted hover:text-white'}`}
              onClick={() => handleToggleSplitMode('EQUAL_50_50')}
            >
              50% / 50% Igualitário
            </button>
          </div>
        </div>

        {/* Resumo Financeiro do Mês em 3 Colunas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div className="glass-card p-3.5 bg-black/20">
            <span className="text-xs text-muted block mb-1">Total Despesas Conjuntas</span>
            <span className="text-xl font-bold text-white">
              {totalSharedExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-[11px] text-muted block mt-1">{pendingSettlements.length} lançamentos no ciclo</span>
          </div>

          <div className="glass-card p-3.5 bg-black/20">
            <span className="text-xs text-muted block mb-1">Pago por {firstName(ownerName)}</span>
            <span className="text-xl font-bold text-cyan-400">
              {totalPaidByUser.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-[11px] text-muted block mt-1">Cota justa: {userFairShare.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>

          <div className="glass-card p-3.5 bg-black/20">
            <span className="text-xs text-muted block mb-1">Pago por {firstName(partnerName)}</span>
            <span className="text-xl font-bold text-pink-400">
              {totalPaidByPartner.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-[11px] text-muted block mt-1">Cota justa: {partnerFairShare.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>

        {/* Banner de Compensação Mútua */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-lg shrink-0">
              ⚖️
            </div>
            <div>
              <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider block">
                Saldo de Compensação do Mês
              </span>
              <p className="text-sm font-bold text-white mt-0.5">
                {netBalance > 0 ? (
                  <span>
                    {firstName(partnerName)} deve transferir{' '}
                    <strong className="text-emerald-400">
                      {Math.abs(netBalance).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>{' '}
                    para você para equilibrar o mês.
                  </span>
                ) : netBalance < 0 ? (
                  <span>
                    Você deve transferir{' '}
                    <strong className="text-rose-400">
                      {Math.abs(netBalance).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>{' '}
                    para {firstName(partnerName)} para equilibrar o mês.
                  </span>
                ) : (
                  <span className="text-emerald-400">
                    As contas estão perfeitamente equilibradas neste mês!
                  </span>
                )}
              </p>
            </div>
          </div>

          {pendingSettlements.length > 0 && Math.abs(netBalance) > 0 && (
            <button
              type="button"
              className="btn btn-secondary text-xs shrink-0 flex items-center gap-1.5"
              onClick={settleAllSharedDebts}
              title="Marcar todas as despesas pendentes deste ciclo como acertadas"
            >
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>Marcar Acerto Realizado</span>
            </button>
          )}
        </div>
      </section>

      {/* ============================================================== */}
      {/* SEÇÃO 4: LISTA DE DESPESAS CONJUNTAS DO CICLO                  */}
      {/* ============================================================== */}
      <section className="glass-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-cyan-400" />
            <h3 className="font-bold text-base text-white">Despesas Compartilhadas</h3>
            <span className="badge badge-cyan text-[10px]">{sharedSettlements.length} itens</span>
          </div>

          <button
            type="button"
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer flex items-center gap-1"
            onClick={() => setIsAddExpenseOpen(true)}
          >
            <Plus size={14} />
            <span>Adicionar Despesa</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-muted uppercase text-[10px]">
                <th className="pb-2">Despesa</th>
                <th className="pb-2">Categoria</th>
                <th className="pb-2">Quem Pagou</th>
                <th className="pb-2 text-right">Valor Total</th>
                <th className="pb-2 text-right">Sua Cota</th>
                <th className="pb-2 text-right">Cota Parceiro(a)</th>
                <th className="pb-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sharedSettlements.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 font-medium text-white">
                    <div>{item.title}</div>
                    <span className="text-[10px] text-muted">{item.date.split('-').reverse().join('/')}</span>
                  </td>
                  <td className="py-2.5">
                    <span className="badge badge-purple text-[10px]">{item.category}</span>
                  </td>
                  <td className="py-2.5">
                    <span className={`badge ${item.paidBy === 'USER' ? 'badge-cyan' : 'badge-pink'} text-[10px]`}>
                      {item.paidBy === 'USER' ? firstName(ownerName) : firstName(partnerName)}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-bold text-white">
                    {item.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="py-2.5 text-right font-medium text-cyan-300">
                    {item.userOwes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="py-2.5 text-right font-medium text-pink-300">
                    {item.partnerOwes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => toggleSharedSettlementStatus(item.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-all ${item.status === 'ACERTADO' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}
                      title="Clique para alternar o status do acerto"
                    >
                      {item.status}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SEÇÃO 5: METAS CONJUNTAS & SONHOS A DOIS                       */}
      {/* ============================================================== */}
      <section className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HeartHandshake size={18} className="text-pink-400" />
            <h3 className="font-bold text-base text-white">Metas & Sonhos Compartilhados</h3>
          </div>
          <span className="text-xs text-muted">Acompanhamento conjunto de longo prazo</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-white">Entrada do Imóvel</span>
              <span className="badge badge-purple text-[10px]">Casa Própria</span>
            </div>
            <div className="text-xs text-muted mb-2">Meta: R$ 120.000,00 • Acumulado: R$ 48.000,00</div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-400 to-purple-500 h-full w-[40%]" />
            </div>
            <div className="flex justify-between text-[10px] text-muted mt-1.5">
              <span>40% concluído</span>
              <span>Aporte conjunto: R$ 2.400/mês</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-white">Viagem de Férias</span>
              <span className="badge badge-cyan text-[10px]">Lazer</span>
            </div>
            <div className="text-xs text-muted mb-2">Meta: R$ 18.000,00 • Acumulado: R$ 12.600,00</div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full w-[70%]" />
            </div>
            <div className="flex justify-between text-[10px] text-muted mt-1.5">
              <span>70% concluído</span>
              <span>Previsto: Dezembro/2026</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-white">Reserva Familiar</span>
              <span className="badge badge-amber text-[10px]">Segurança</span>
            </div>
            <div className="text-xs text-muted mb-2">Meta: R$ 50.000,00 • Acumulado: R$ 35.000,00</div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full w-[70%]" />
            </div>
            <div className="flex justify-between text-[10px] text-muted mt-1.5">
              <span>70% concluído</span>
              <span>6 meses de custos cobertos</span>
            </div>
          </div>
        </div>
      </section>

      </>
      )}

      {/* Modal / Diálogo Rápido de Nova Despesa Conjunta */}
      {isAddExpenseOpen && (
        <div className="onboarding-overlay animate-fade-in" onClick={() => setIsAddExpenseOpen(false)}>
          <div className="onboarding-dialog glass-card max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-cyan-400" />
                  <h3 className="font-bold text-base text-white">Nova Despesa Conjunta</h3>
                </div>
                <button
                  type="button"
                  className="text-muted hover:text-white"
                  onClick={() => setIsAddExpenseOpen(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                  <label className="text-xs text-muted block mb-1">Descrição da Despesa</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Jantar de Comemoração, Mercado, etc."
                    value={newExpenseTitle}
                    onChange={(e) => setNewExpenseTitle(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-black/30 border border-white/10 text-white text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Valor (R$)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="0,00"
                      value={newExpenseAmount}
                      onChange={(e) => setNewExpenseAmount(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-black/30 border border-white/10 text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted block mb-1">Categoria</label>
                    <select
                      value={newExpenseCategory}
                      onChange={(e) => setNewExpenseCategory(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-black/30 border border-white/10 text-white text-xs"
                    >
                      <option value="Alimentação">Alimentação</option>
                      <option value="Moradia">Moradia</option>
                      <option value="Transporte">Transporte</option>
                      <option value="Lazer">Lazer</option>
                      <option value="Saúde">Saúde</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted block mb-1">Quem efetuou o pagamento?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${newExpensePaidBy === 'USER' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-black/20 border-white/10 text-muted'}`}
                      onClick={() => setNewExpensePaidBy('USER')}
                    >
                      {firstName(ownerName)}
                    </button>
                    <button
                      type="button"
                      className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${newExpensePaidBy === 'PARTNER' ? 'bg-pink-500/20 border-pink-500 text-pink-300' : 'bg-black/20 border-white/10 text-muted'}`}
                      onClick={() => setNewExpensePaidBy('PARTNER')}
                    >
                      {firstName(partnerName)}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary text-xs"
                    onClick={() => setIsAddExpenseOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary text-xs">
                    Adicionar ao Rateio
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
