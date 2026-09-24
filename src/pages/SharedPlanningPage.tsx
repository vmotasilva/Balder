import React, { useState } from 'react';
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
} from 'lucide-react';
import type { ExpenseSplitMode } from '../types';

export const SharedPlanningPage: React.FC = () => {
  const { user } = useAuth();
  const {
    activeTrackingScope,
    defaultTrackingScope,
    setActiveTrackingScope,
    setDefaultTrackingScope,
    sharedScenario,
    updateSharedScenario,
    sharedSettlements,
    addSharedSettlement,
    toggleSharedSettlementStatus,
    settleAllSharedDebts,
    salaryContracts,
  } = useFinancial();

  const [copiedInvite, setCopiedInvite] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('Alimentação');
  const [newExpensePaidBy, setNewExpensePaidBy] = useState<'USER' | 'PARTNER'>('USER');

  // Cálculos do Rateio de Renda
  const userSalary = salaryContracts?.find((s) => s.isActive)?.currentNetAmount || 8500;
  const partnerSalary = sharedScenario?.members?.find((m) => m.role === 'PARTNER')?.monthlyIncome || 5200;
  const totalHouseholdIncome = userSalary + partnerSalary;

  const proportionalUserPct = Math.round((userSalary / totalHouseholdIncome) * 100);
  const proportionalPartnerPct = 100 - proportionalUserPct;

  const currentSplitMode = sharedScenario?.splitMode || 'PROPORTIONAL_INCOME';
  const effectiveUserPct = currentSplitMode === 'EQUAL_50_50' ? 50 : proportionalUserPct;
  const effectivePartnerPct = currentSplitMode === 'EQUAL_50_50' ? 50 : proportionalPartnerPct;

  // Cálculos de Acerto do Mês
  const pendingSettlements = sharedSettlements.filter((s) => s.status === 'PENDENTE');
  const totalSharedExpenses = pendingSettlements.reduce((acc, s) => acc + s.totalAmount, 0);

  const totalPaidByUser = pendingSettlements
    .filter((s) => s.paidBy === 'USER')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const totalPaidByPartner = pendingSettlements
    .filter((s) => s.paidBy === 'PARTNER')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const userFairShare = (totalSharedExpenses * effectiveUserPct) / 100;
  const partnerFairShare = (totalSharedExpenses * effectivePartnerPct) / 100;

  // Diferença: se positivo, usuário pagou mais que sua cota (parceiro deve transferir ao usuário)
  const netBalance = totalPaidByUser - userFairShare;

  const handleCopyInvite = () => {
    const inviteText = `https://balder.app/join?code=${sharedScenario?.inviteCode || 'BALDER-CASAL-7829'}`;
    navigator.clipboard.writeText(inviteText);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  const handleToggleSplitMode = (mode: ExpenseSplitMode) => {
    if (!sharedScenario) return;
    updateSharedScenario({
      splitMode: mode,
      userSharePercent: mode === 'EQUAL_50_50' ? 50 : proportionalUserPct,
      partnerSharePercent: mode === 'EQUAL_50_50' ? 50 : proportionalPartnerPct,
    });
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(newExpenseAmount.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!newExpenseTitle.trim() || isNaN(amountNum) || amountNum <= 0) return;

    const userOwes = (amountNum * effectiveUserPct) / 100;
    const partnerOwes = (amountNum * effectivePartnerPct) / 100;

    addSharedSettlement({
      title: newExpenseTitle.trim(),
      category: newExpenseCategory,
      totalAmount: amountNum,
      paidBy: newExpensePaidBy,
      splitMode: currentSplitMode,
      userOwes,
      partnerOwes,
      date: new Date().toISOString().split('T')[0],
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
          <h1 className="page-title">Planejamento Compartilhado</h1>
          <p className="page-subtitle">
            Acompanhe o orçamento conjunto, divisão inteligente de despesas e metas em comum
          </p>
        </div>

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
      </div>

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

      {/* ============================================================== */}
      {/* GRID DE MEMBROS & PARCERIA CONECTADA                            */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Membro 1: Você */}
        <div className="glass-card p-4 border border-cyan-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center font-bold text-cyan-300">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'VM'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white">{user?.name || 'Vinicius Mota Silva'}</h4>
                  <span className="badge badge-cyan text-[9px]">Titular</span>
                </div>
                <span className="text-xs text-muted">{user?.email || 'vinicius@balder.app'}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted block">Renda Líquida</span>
              <span className="font-bold text-sm text-cyan-300">
                {userSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs bg-white/5 rounded-lg p-2.5">
            <span className="text-muted">Cota de Rateio Calculada:</span>
            <span className="font-bold text-cyan-400">{effectiveUserPct}% das despesas</span>
          </div>
        </div>

        {/* Membro 2: Parceiro(a) */}
        <div className="glass-card p-4 border border-pink-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-500/20 border border-pink-500/40 flex items-center justify-center font-bold text-pink-300">
                CS
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white">Camila Silva</h4>
                  <span className="badge badge-purple text-[9px]">Conectada</span>
                </div>
                <span className="text-xs text-muted">camila@email.com</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted block">Renda Estimada</span>
              <span className="font-bold text-sm text-pink-300">
                {partnerSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs bg-white/5 rounded-lg p-2.5">
            <span className="text-muted">Cota de Rateio Calculada:</span>
            <span className="font-bold text-pink-400">{effectivePartnerPct}% das despesas</span>
          </div>
        </div>
      </div>

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
          <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${currentSplitMode === 'PROPORTIONAL_INCOME' ? 'bg-indigo-600 text-white shadow' : 'text-muted hover:text-white'}`}
              onClick={() => handleToggleSplitMode('PROPORTIONAL_INCOME')}
            >
              Proporcional à Renda ({proportionalUserPct}/{proportionalPartnerPct})
            </button>
            <button
              type="button"
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
            <span className="text-xs text-muted block mb-1">Pago por Vinicius</span>
            <span className="text-xl font-bold text-cyan-400">
              {totalPaidByUser.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-[11px] text-muted block mt-1">Cota justa: {userFairShare.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>

          <div className="glass-card p-3.5 bg-black/20">
            <span className="text-xs text-muted block mb-1">Pago por Camila</span>
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
                    Camila deve transferir{' '}
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
                    para Camila para equilibrar o mês.
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
                      {item.paidBy === 'USER' ? 'Vinicius' : 'Camila'}
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
                      Vinicius (Você)
                    </button>
                    <button
                      type="button"
                      className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${newExpensePaidBy === 'PARTNER' ? 'bg-pink-500/20 border-pink-500 text-pink-300' : 'bg-black/20 border-white/10 text-muted'}`}
                      onClick={() => setNewExpensePaidBy('PARTNER')}
                    >
                      Camila (Parceira)
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
