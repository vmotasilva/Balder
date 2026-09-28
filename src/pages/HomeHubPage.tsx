import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Camera,
  Send,
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Layers,
  Target,
  Landmark,
  Users,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { useAuth } from '../context/AuthContext';
import { GuidedSetup } from '../components/GuidedSetup';
import type { TabId } from '../components/Sidebar';
import { buildPeriodInsights, TRACKING_PERIOD_LABELS } from '../utils/periodSpending';
import type { TrackingPeriod } from '../utils/periodSpending';
import { getItemOccurrences } from '../utils/mappingItemState';
import type { ForecastEntry } from '../utils/forecastWindow';

interface HomeHubPageProps {
  onNavigate: (tab: TabId) => void;
  onOpenForseti: () => void;
  onOpenOnboarding: (step?: number) => void;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shortDate = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

const PERIODS: TrackingPeriod[] = ['SEMANA', 'QUINZENA', 'MES'];

/**
 * Início: o hub do Balder. Responde "o que aconteceu?" (Forseti), "como estou?" (3 números),
 * "o que faço agora?" (tarefas do período), "como vão os gastos?" (resumo do período preferido)
 * e "para onde vou?" (módulos com status). Para quem ainda não configurou, mostra a conversa guiada.
 */
export const HomeHubPage: React.FC<HomeHubPageProps> = ({ onNavigate, onOpenForseti, onOpenOnboarding }) => {
  const { user } = useAuth();
  const {
    isDataReady,
    activeCheckpoint,
    movements,
    natures,
    goals,
    goalStatuses,
    forecasts,
    availableBalance,
    viewPreferences,
    setViewPreferences,
    getNatureCeiling,
    updateMovement,
    updateMappingItemState,
    sendMessageToCopilot,
  } = useFinancial();

  const [forsetiText, setForsetiText] = useState('');
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [finishedSetup, setFinishedSetup] = useState(false);

  const period: TrackingPeriod = viewPreferences.trackingPeriod || 'MES';
  const labels = TRACKING_PERIOD_LABELS[period];
  const today = new Date();
  const todayIso = isoOf(today);
  const firstName = (user?.name || '').split(' ')[0];

  const onboardingDone = (() => {
    try {
      return localStorage.getItem(user && !user.isGuest ? `balder_onboarding_completed_${user.$id}` : 'balder_onboarding_completed_guest') === 'true';
    } catch {
      return false;
    }
  })();
  // Uma vez aberta, a conversa segue até a pessoa sair dela: salvar cria o marco, mas a mensagem final
  // da Forseti ainda precisa aparecer
  const [inSetup, setInSetup] = useState(false);
  if (isDataReady && !activeCheckpoint && !onboardingDone && !inSetup && !finishedSetup) setInSetup(true);
  const needsSetup = inSetup && !finishedSetup;

  // Janela do período preferido (a mesma usada nas previsões: semana até domingo, quinzena, mês)
  const periodWindow = forecasts[period === 'MES' ? 'MES' : period];

  // ── Tarefas: vencidos primeiro, depois o que vence no período ──
  const tasks = useMemo(
    () =>
      [...periodWindow.entries].sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.date.localeCompare(b.date)),
    [periodWindow]
  );
  const visibleTasks = showAllTasks ? tasks : tasks.slice(0, 4);

  const findNatureItem = (entry: ForecastEntry) => {
    const itemId = entry.id.replace(/^nat_/, '').replace(/_(overdue|upcoming)$/, '');
    for (const nat of natures) {
      for (const mapping of nat.mappings) {
        const item = mapping.items.find((it) => it.id === itemId);
        if (item) return { nat, mapping, item };
      }
    }
    return null;
  };

  const renderTaskAction = (entry: ForecastEntry) => {
    if (entry.source === 'FATURA') {
      return (
        <button type="button" className="btn btn-outline btn-xs" onClick={() => onNavigate('FATURAS')}>
          Ver fatura
        </button>
      );
    }
    if (entry.source === 'NATUREZA') {
      const found = findNatureItem(entry);
      const monthKey = entry.date.slice(0, 7);
      // Itens com uma cobrança no mês: um toque registra o pagamento de hoje; os demais abrem a natureza
      const occurrences = found ? getItemOccurrences(found.item, monthKey) : [];
      if (found && occurrences.length === 1) {
        const { item } = found;
        return (
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={() =>
              updateMappingItemState(found.nat.id, found.mapping.id, item.id, {
                payments: {
                  ...(item.payments || {}),
                  [monthKey]: [
                    ...(item.payments?.[monthKey] || []),
                    {
                      id: `pay_${Date.now()}`,
                      paidAt: todayIso,
                      amount: entry.amount,
                      expectedAmount: entry.amount,
                      coveredDates: [occurrences[0].date],
                    },
                  ],
                },
              })
            }
          >
            Já paguei
          </button>
        );
      }
      return (
        <button type="button" className="btn btn-outline btn-xs" onClick={() => onNavigate('NATUREZAS')}>
          Ver
        </button>
      );
    }
    return (
      <button
        type="button"
        className="btn btn-outline btn-xs"
        onClick={() => updateMovement(entry.id, { status: 'REALIZADA', paymentDate: todayIso })}
      >
        {entry.kind === 'ENTRADA' ? 'Já recebi' : 'Já paguei'}
      </button>
    );
  };

  const whenLabel = (entry: ForecastEntry) => {
    if (entry.overdue) return `venceu ${shortDate(entry.date)}`;
    if (entry.date === todayIso) return 'hoje';
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (entry.date === isoOf(tomorrow)) return 'amanhã';
    return shortDate(entry.date);
  };

  // ── Gastos do período por natureza ──
  const periodSpending = useMemo(
    () =>
      buildPeriodInsights({
        natures,
        movements,
        period,
        monthlyCeiling: (nat, monthKey) => getNatureCeiling(nat, monthKey),
      }),
    [natures, movements, period, getNatureCeiling]
  );
  const topAlert = periodSpending.insights.find((i) => i.level === 'ACIMA');

  // ── Próximo recebimento ──
  const nextIncome = useMemo(
    () =>
      movements
        .filter((m) => m.type === 'RECEBER' && m.status === 'PREVISTA' && m.dueDate >= todayIso)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0],
    [movements, todayIso]
  );

  // ── Status de cada módulo ──
  const moduleStatus = useMemo(() => {
    const openInvoices = movements.filter((m) => m.type === 'CARTAO' && m.status === 'PREVISTA');
    const invoicesTotal = openInvoices.reduce((acc, m) => acc + m.amount, 0);
    const dueInPeriod = periodWindow.entries.filter((e) => e.source !== 'NATUREZA' && e.source !== 'FATURA').length;
    const activeGoals = goals.filter((g) => !goalStatuses[g.id]);
    const goalsProgress =
      activeGoals.length > 0
        ? Math.round(
            (activeGoals.reduce((acc, g) => acc + Math.min(1, g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0), 0) /
              activeGoals.length) *
              100
          )
        : 0;
    const nextInstallment = movements
      .filter((m) => m.type === 'EMPRESTIMO' && m.category !== 'Recebimento' && m.status === 'PREVISTA' && m.dueDate >= todayIso)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

    return {
      movimentacoes: dueInPeriod > 0 ? { text: `${dueInPeriod} vencem ${labels.this}`, tone: 'warn' } : { text: 'Tudo em dia', tone: 'ok' },
      faturas:
        openInvoices.length > 0
          ? { text: `${openInvoices.length} aberta(s) · ${formatBRL(invoicesTotal)}`, tone: '' }
          : { text: 'Cadastre seu cartão', tone: 'invite' },
      naturezas: natures.length > 0 ? { text: `${natures.length} naturezas`, tone: '' } : { text: 'Organize seus gastos', tone: 'invite' },
      metas:
        activeGoals.length > 0
          ? { text: `${activeGoals.length} ativa(s) · ${goalsProgress}%`, tone: '' }
          : { text: 'Crie sua primeira meta', tone: 'invite' },
      emprestimos: nextInstallment
        ? { text: `Parcela em ${shortDate(nextInstallment.dueDate)}`, tone: '' }
        : { text: 'Simule ou cadastre', tone: 'invite' },
    };
  }, [movements, natures, goals, goalStatuses, periodWindow, todayIso, labels.this]);

  const modules: { tab: TabId; label: string; icon: React.ElementType; status: { text: string; tone: string } }[] = [
    { tab: 'DASHBOARD', label: 'Painel', icon: LayoutDashboard, status: { text: 'Indicadores e projeção', tone: '' } },
    { tab: 'MOVIMENTACOES', label: 'Movimentações', icon: ArrowLeftRight, status: moduleStatus.movimentacoes },
    { tab: 'FATURAS', label: 'Faturas', icon: CreditCard, status: moduleStatus.faturas },
    { tab: 'NATUREZAS', label: 'Naturezas', icon: Layers, status: moduleStatus.naturezas },
    { tab: 'METAS', label: 'Metas', icon: Target, status: moduleStatus.metas },
    { tab: 'EMPRESTIMOS', label: 'Empréstimos', icon: Landmark, status: moduleStatus.emprestimos },
    { tab: 'COMPARTILHADO', label: 'Planejamento conjunto', icon: Users, status: { text: 'Acompanhe com alguém', tone: 'invite' } },
  ];

  const submitForseti = (e: React.FormEvent) => {
    e.preventDefault();
    const text = forsetiText.trim();
    if (!text) {
      onOpenForseti();
      return;
    }
    sendMessageToCopilot(text);
    setForsetiText('');
    onOpenForseti();
  };

  if (!isDataReady) {
    return <div className="home-hub"><p className="text-sm text-muted">Carregando…</p></div>;
  }

  if (needsSetup) {
    return (
      <div className="home-hub">
        <header className="home-hub-header">
          <h1>{firstName ? `Bem-vindo, ${firstName}` : 'Bem-vindo ao Balder'}</h1>
          <p>Leva uns 3 minutos. Você pode mudar tudo depois.</p>
        </header>
        <GuidedSetup onChooseManual={() => onOpenOnboarding(1)} onFinished={() => setFinishedSetup(true)} />
      </div>
    );
  }

  return (
    <div className="home-hub">
      <header className="home-hub-header">
        <h1>
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p>{today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </header>

      {/* O que aconteceu? */}
      <form className="home-forseti-bar" onSubmit={submitForseti}>
        <Sparkles size={18} className="text-cyan" aria-hidden="true" />
        <input
          value={forsetiText}
          onChange={(e) => setForsetiText(e.target.value)}
          placeholder='Conte à Forseti o que aconteceu: "paguei 50 no mercado"'
          aria-label="Mensagem para a Forseti"
        />
        <button type="button" className="home-forseti-icon" onClick={onOpenForseti} aria-label="Enviar foto do cupom" title="Enviar foto do cupom">
          <Camera size={18} />
        </button>
        <button type="submit" className="home-forseti-icon is-send" aria-label="Enviar">
          <Send size={16} />
        </button>
      </form>

      {/* Como estou? */}
      <div className="home-stats">
        <div className="home-stat">
          <span>Saldo hoje</span>
          <strong>{formatBRL(availableBalance)}</strong>
        </div>
        <div className="home-stat">
          <span>Previsto {labels.end}</span>
          <strong className={periodWindow.projectedBalance < 0 ? 'text-rose' : 'text-emerald'}>{formatBRL(periodWindow.projectedBalance)}</strong>
        </div>
        <div className="home-stat">
          <span>Próximo recebimento</span>
          <strong>{nextIncome ? shortDate(nextIncome.dueDate) : '—'}</strong>
          {nextIncome && <small>{formatBRL(nextIncome.amount)}</small>}
        </div>
      </div>

      {/* O que faço agora? */}
      <section className="home-card">
        <div className="home-card-head">
          <h2>Para fazer agora</h2>
          <span>{tasks.length > 0 ? `${tasks.length} ${labels.this}` : ''}</span>
        </div>
        {tasks.length === 0 ? (
          <p className="home-empty">
            <CheckCircle2 size={16} className="text-emerald" /> Nada vencendo {labels.this}.
          </p>
        ) : (
          <ul className="home-task-list">
            {visibleTasks.map((entry) => (
              <li key={entry.id} className={entry.overdue ? 'is-overdue' : ''}>
                <div className="home-task-main">
                  <span className="home-task-title">{entry.title}</span>
                  <span className="home-task-meta">
                    {whenLabel(entry)} · <span className={entry.kind === 'ENTRADA' ? 'text-emerald' : 'text-rose'}>{formatBRL(entry.amount)}</span>
                  </span>
                </div>
                {renderTaskAction(entry)}
              </li>
            ))}
          </ul>
        )}
        {tasks.length > 4 && (
          <button type="button" className="link-button" onClick={() => setShowAllTasks((v) => !v)}>
            {showAllTasks ? 'Mostrar menos' : `Ver todas (${tasks.length})`}
          </button>
        )}
      </section>

      {/* Como vão os gastos no período? */}
      <section className="home-card">
        <div className="home-card-head">
          <h2>Gastos {labels.this}</h2>
          <div className="home-period-switch" role="group" aria-label="Período de acompanhamento">
            {PERIODS.map((p) => (
              <button key={p} type="button" className={p === period ? 'is-active' : ''} onClick={() => setViewPreferences({ trackingPeriod: p })}>
                {TRACKING_PERIOD_LABELS[p].name}
              </button>
            ))}
          </div>
        </div>
        {periodSpending.insights.length === 0 ? (
          <p className="home-empty">Nenhum gasto registrado {labels.this}. Conte à Forseti quando gastar.</p>
        ) : (
          <>
            <p className={`home-spending-headline ${topAlert ? 'is-alert' : ''}`}>
              {topAlert ? (
                <>
                  <AlertTriangle size={14} /> Já gastamos bastante com {topAlert.name.toLowerCase()} {labels.this}: {formatBRL(topAlert.spent)} de{' '}
                  {formatBRL(topAlert.expected)} esperados.
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} /> {formatBRL(periodSpending.totalSpent)} gastos {labels.this}, dentro do esperado.
                </>
              )}
            </p>
            <ul className="home-spending-list">
              {periodSpending.insights.slice(0, 5).map((i) => (
                <li key={i.natureId}>
                  <span className="home-spending-name">
                    {i.icon} {i.name}
                  </span>
                  <span className="home-spending-value">
                    {formatBRL(i.spent)}
                    {i.expected > 0 && <small> de {formatBRL(i.expected)}</small>}
                  </span>
                  {i.expected > 0 && (
                    <div className="home-spending-bar" title={i.basis === 'TETO' ? 'Comparado à parte do teto no período' : 'Comparado à sua média'}>
                      <div className={`is-${i.level.toLowerCase()}`} style={{ width: `${Math.min(100, Math.round(i.ratio * 100))}%` }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Para onde vou? */}
      <section className="home-modules">
        {modules.map((m) => (
          <button key={m.tab} type="button" className="home-module" onClick={() => onNavigate(m.tab)}>
            <m.icon size={18} aria-hidden="true" />
            <span className="home-module-label">{m.label}</span>
            <span className={`home-module-status ${m.status.tone ? `is-${m.status.tone}` : ''}`}>{m.status.text}</span>
            <ChevronRight size={14} className="home-module-arrow" aria-hidden="true" />
          </button>
        ))}
      </section>
    </div>
  );
};
