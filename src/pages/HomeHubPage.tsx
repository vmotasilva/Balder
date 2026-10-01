import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Camera,
  History,
  Send,
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Layers,
  Target,
  FileText,
  BadgePercent,
  Users,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { useAuth } from '../context/AuthContext';
import { useAccountScope } from '../context/AccountScopeContext';
import { GuidedSetup } from '../components/GuidedSetup';
import { ForsetiActivityModal } from '../components/ForsetiActivityModal';
import { activityCutoffIso } from '../services/forsetiActivityService';
import { PlanningSwitcher } from '../components/PlanningSwitcher';
import type { TabId } from '../components/Sidebar';
import { buildPeriodItems, periodRangeLabel, shiftPeriodDate, trackingPeriodRange, TRACKING_PERIOD_LABELS } from '../utils/periodSpending';
import type { PeriodItem, PeriodPurchase, TrackingPeriod } from '../utils/periodSpending';
import { getItemOccurrences } from '../utils/mappingItemState';
import { MappingPaymentModal, type MappingPaymentTarget } from '../components/MappingPaymentModal';
import { RealizationConfirmModal, realizedMovementUpdates, type RealizationTarget } from '../components/RealizationConfirmModal';
import type { ForecastEntry } from '../utils/forecastWindow';
import { displayName } from '../utils/displayName';
import { userNatures } from '../utils/baseNatures';
import { PeriodMovementsModal, isMovementIncome, movementDate, movementValue } from '../components/PeriodMovementsModal';

interface HomeHubPageProps {
  onNavigate: (tab: TabId) => void;
  onOpenForseti: () => void;
  onOpenOnboarding: (step?: number) => void;
  onPlanWithOthers: () => void;
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

/** Linha da lista de tarefas: um lançamento ou um grupo (natureza ou mapeamento) que abre o próximo nível. */
type TaskRow =
  | { type: 'ENTRY'; entry: ForecastEntry }
  | { type: 'GROUP'; id: string; title: string; amount: number; count: number; date: string; overdue: boolean; open: () => void };

const rowOrder = (r: TaskRow) => (r.type === 'ENTRY' ? r.entry : r);
const sortRows = (rows: TaskRow[]) =>
  rows.sort((a, b) => {
    const x = rowOrder(a);
    const y = rowOrder(b);
    return Number(y.overdue) - Number(x.overdue) || x.date.localeCompare(y.date);
  });

/** Agrupa os itens de natureza por uma chave, somando valores e guardando o vencimento mais próximo. */
const groupEntries = (entries: ForecastEntry[], keyOf: (e: ForecastEntry) => string | undefined) => {
  const groups = new Map<string, { amount: number; count: number; date: string; overdue: boolean }>();
  entries.forEach((e) => {
    const key = keyOf(e);
    if (!key) return;
    const g = groups.get(key) || { amount: 0, count: 0, date: e.date, overdue: false };
    g.amount += e.amount;
    g.count += 1;
    if (e.date < g.date) g.date = e.date;
    g.overdue = g.overdue || e.overdue;
    groups.set(key, g);
  });
  return groups;
};

/** Totais de um conjunto de itens do período (uma natureza, um item ou o período todo). */
const sumItems = (list: PeriodItem[]) => ({
  planned: list.reduce((acc, i) => acc + i.planned, 0),
  spent: list.reduce((acc, i) => acc + i.spent, 0),
  done: list.reduce((acc, i) => acc + i.done, 0),
  total: list.reduce((acc, i) => acc + i.total, 0),
  overdue: list.filter((i) => i.overdue).length,
  nextDate: list
    .map((i) => i.nextDate)
    .filter((d): d is string => !!d)
    .sort()[0],
});
type SpendingTotals = ReturnType<typeof sumItems>;

/** Linha do card de gastos: um item (com suas compras) ou uma natureza que abre os itens dela. */
type SpendingRow = { overdue: boolean; nextDate?: string } & (
  | { type: 'ITEM'; item: PeriodItem }
  | { type: 'NATURE'; id: string; title: string; items: PeriodItem[] }
);

// Atrasados primeiro, depois pela próxima compra em aberto; o que já foi todo feito vai para o fim
const byOpenDate = (a: { overdue: boolean; nextDate?: string }, b: { overdue: boolean; nextDate?: string }) =>
  Number(b.overdue) - Number(a.overdue) || (a.nextDate || '9999').localeCompare(b.nextDate || '9999');

const PURCHASE_PILL: Record<PeriodPurchase['status'], string> = {
  FEITA: 'Feita',
  PREVISTA: 'Prevista',
  ATRASADA: 'Atrasada',
  NAO_VAI: 'Não vai',
  TERCEIROS: 'Terceiros',
};

/**
 * Início: o hub do Balder. Responde "o que aconteceu?" (Forseti), "como estou?" (3 números),
 * "o que faço agora?" (tarefas do período), "como vão os gastos?" (resumo do período preferido)
 * e "para onde vou?" (módulos com status). Para quem ainda não configurou, mostra a conversa guiada.
 */
export const HomeHubPage: React.FC<HomeHubPageProps> = ({ onNavigate, onOpenForseti, onPlanWithOthers }) => {
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
    updateMovement,
    updateMappingItemState,
    sendMessageToCopilot,
    forsetiActivity,
    sharedScenario,
    natureDetailModes,
  } = useFinancial();
  const { viewing } = useAccountScope();

  const [forsetiText, setForsetiText] = useState('');
  const [showAllTasks, setShowAllTasks] = useState(false);
  // Níveis da lista: naturezas → mapeamentos da natureza → itens do mapeamento
  const [drill, setDrill] = useState<{ natureId: string; mappingId?: string } | null>(null);
  const [mappingPayment, setMappingPayment] = useState<MappingPaymentTarget | null>(null);
  const [realization, setRealization] = useState<RealizationTarget | null>(null);
  const [finishedSetup, setFinishedSetup] = useState(false);
  // Quantos períodos para trás o card de gastos está mostrando (0 = período atual)
  const [spendingOffset, setSpendingOffset] = useState(0);
  const [spendingNatureId, setSpendingNatureId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [showAllSpending, setShowAllSpending] = useState(false);

  const period: TrackingPeriod = viewPreferences.trackingPeriod || 'MES';
  const labels = TRACKING_PERIOD_LABELS[period];
  const today = new Date();
  const todayIso = isoOf(today);
  const firstName = displayName(user?.name, viewPreferences);

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

  // Nível aberto (volta sozinho um nível quando tudo dele já foi pago)
  const drillNature = drill ? natures.find((n) => n.id === drill.natureId) : undefined;
  const natureTasks = drillNature ? tasks.filter((e) => e.natureId === drillNature.id) : [];
  const openNature = natureTasks.length > 0 ? drillNature : undefined;
  const drillMapping = openNature && drill?.mappingId ? openNature.mappings.find((m) => m.id === drill.mappingId) : undefined;
  const mappingTasks = drillMapping ? natureTasks.filter((e) => e.mappingId === drillMapping.id) : [];
  const openMapping = mappingTasks.length > 0 ? drillMapping : undefined;
  const levelTasks = openMapping ? mappingTasks : natureTasks;

  const taskRows = useMemo<TaskRow[]>(() => {
    if (openNature && openMapping) {
      return tasks
        .filter((e) => e.natureId === openNature.id && e.mappingId === openMapping.id)
        .map((entry) => ({ type: 'ENTRY' as const, entry }));
    }
    if (openNature) {
      const natureEntries = tasks.filter((e) => e.natureId === openNature.id);
      const byMapping = groupEntries(
        natureEntries.filter((e) => !e.mappingSummary),
        (e) => e.mappingId
      );
      return sortRows([
        ...natureEntries.filter((e) => e.mappingSummary).map((entry) => ({ type: 'ENTRY' as const, entry })),
        ...[...byMapping].map(([mappingId, g]) => ({
          type: 'GROUP' as const,
          id: mappingId,
          title: openNature.mappings.find((m) => m.id === mappingId)?.name || 'Mapeamento',
          ...g,
          open: () => setDrill({ natureId: openNature.id, mappingId }),
        })),
      ]);
    }
    const byNature = groupEntries(tasks, (e) => (e.source === 'NATUREZA' ? e.natureId : undefined));
    return sortRows([
      ...tasks.filter((e) => e.source !== 'NATUREZA' || !e.natureId).map((entry) => ({ type: 'ENTRY' as const, entry })),
      ...[...byNature].map(([natureId, g]) => {
        const nat = natures.find((n) => n.id === natureId);
        return {
          type: 'GROUP' as const,
          id: natureId,
          title: nat ? `${nat.icon ? `${nat.icon} ` : ''}${nat.name}` : 'Natureza',
          ...g,
          open: () => setDrill({ natureId }),
        };
      }),
    ]);
  }, [tasks, natures, openNature, openMapping]);

  const atRoot = !openNature;
  const visibleRows = atRoot && !showAllTasks ? taskRows.slice(0, 4) : taskRows;

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
    if (entry.source === 'NATUREZA' && entry.mappingSummary && entry.natureId && entry.mappingId) {
      const mapping = natures.find((n) => n.id === entry.natureId)?.mappings.find((m) => m.id === entry.mappingId);
      return (
        <button
          type="button"
          className="btn btn-outline btn-xs"
          onClick={() =>
            mapping &&
            setMappingPayment({
              natureId: entry.natureId!,
              mappingId: mapping.id,
              itemIds: mapping.items.filter((it) => it.paymentMethod !== 'CARTAO').map((it) => it.id),
              monthKey: entry.date.slice(0, 7),
              title: mapping.name,
            })
          }
        >
          Lançar
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
              setRealization({
                kind: 'SAIDA',
                title: entry.title,
                expectedAmount: entry.amount,
                dueDate: occurrences[0].date,
                onConfirm: (amount, paidAt) =>
                  updateMappingItemState(found.nat.id, found.mapping.id, item.id, {
                    payments: {
                      ...(item.payments || {}),
                      [monthKey]: [
                        ...(item.payments?.[monthKey] || []),
                        {
                          id: `pay_${Date.now()}`,
                          paidAt,
                          amount,
                          expectedAmount: entry.amount,
                          coveredDates: [occurrences[0].date],
                        },
                      ],
                    },
                  }),
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
    // Receita de outra pessoa: só quem recebe confirma
    const mov = movements.find((m) => m.id === entry.id);
    const confirmer = mov?.type === 'RECEBER' ? mov.responsibleId || viewing?.ownerId || user?.$id : undefined;
    if (confirmer && user && !user.isGuest && confirmer !== user.$id) {
      const name =
        sharedScenario?.members?.find((p) => p.id === confirmer)?.name ||
        (confirmer === viewing?.ownerId ? viewing?.ownerName : undefined) ||
        'quem recebe';
      return <span className="home-task-owner">Só {name.split(' ')[0]} confirma</span>;
    }
    return (
      <button
        type="button"
        className="btn btn-outline btn-xs"
        onClick={() =>
          mov
            ? setRealization({
                kind: entry.kind === 'ENTRADA' ? 'ENTRADA' : 'SAIDA',
                title: entry.title,
                expectedAmount: mov.amount,
                dueDate: mov.dueDate,
                onConfirm: (amount, date) => updateMovement(mov.id, realizedMovementUpdates(mov, amount, date)),
              })
            : undefined
        }
      >
        {entry.kind === 'ENTRADA' ? 'Já recebi' : 'Já paguei'}
      </button>
    );
  };

  const whenLabel = (entry: Pick<ForecastEntry, 'date' | 'overdue'>) => {
    if (entry.overdue) return `venceu ${shortDate(entry.date)}`;
    if (entry.date === todayIso) return 'hoje';
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (entry.date === isoOf(tomorrow)) return 'amanhã';
    return shortDate(entry.date);
  };

  // ── Compras do período, item a item (o atual, um anterior ou a previsão de um futuro, escolhido nas setas) ──
  const spendingRange = useMemo(
    () => trackingPeriodRange(period, shiftPeriodDate(period, new Date(), spendingOffset)),
    [period, spendingOffset]
  );
  const { tense: spendingTense, items: periodItems } = useMemo(
    () =>
      buildPeriodItems({ natures, movements, range: spendingRange, startDate: activeCheckpoint?.startDate, natureDetailModes }),
    [natures, movements, spendingRange, activeCheckpoint?.startDate, natureDetailModes]
  );
  // Antes do marco não há o que mostrar: a seta para trás para no período em que o marco começa
  const atSpendingStart = !!activeCheckpoint?.startDate && spendingRange.from <= activeCheckpoint.startDate;
  const isCurrentSpending = spendingOffset === 0;
  const isFutureSpending = spendingTense === 'FUTURO';
  const spendingWhen = isCurrentSpending ? labels.this : labels.that;
  const nextPeriodLabel = period === 'MES' ? 'Próximo mês' : `Próxima ${labels.name.toLowerCase()}`;

  const goToSpending = (offset: number) => {
    setSpendingOffset(offset);
    setExpandedItemId(null);
  };

  const spendingTotals = sumItems(periodItems);

  // Nível aberto: os itens de uma natureza (volta sozinho quando a natureza não tem compras no período)
  const spendingNature = spendingNatureId ? natures.find((n) => n.id === spendingNatureId) : undefined;
  const openSpendingNature = spendingNature && periodItems.some((i) => i.natureId === spendingNature.id) ? spendingNature : undefined;

  const spendingRows = useMemo<SpendingRow[]>(() => {
    if (openSpendingNature) {
      return periodItems
        .filter((i) => i.natureId === openSpendingNature.id)
        .sort(byOpenDate)
        .map((item) => ({ type: 'ITEM' as const, item, overdue: item.overdue, nextDate: item.nextDate }));
    }
    const groups = new Map<string, PeriodItem[]>();
    periodItems.forEach((i) => {
      if (i.natureId) groups.set(i.natureId, [...(groups.get(i.natureId) || []), i]);
    });
    return [
      ...periodItems.filter((i) => !i.natureId).map((item) => ({ type: 'ITEM' as const, item, overdue: item.overdue, nextDate: item.nextDate })),
      ...[...groups].map(([natureId, items]) => {
        const nat = natures.find((n) => n.id === natureId);
        const totals = sumItems(items);
        return {
          type: 'NATURE' as const,
          id: natureId,
          title: nat ? `${nat.icon ? `${nat.icon} ` : ''}${nat.name}` : 'Natureza',
          items,
          overdue: totals.overdue > 0,
          nextDate: totals.nextDate,
        };
      }),
    ].sort(byOpenDate);
  }, [periodItems, natures, openSpendingNature]);
  const visibleSpendingRows = !openSpendingNature && !showAllSpending ? spendingRows.slice(0, 5) : spendingRows;

  const describePurchase = (p: PeriodPurchase) => {
    if (p.status === 'FEITA') {
      const diff = (p.paidAmount || 0) - p.plannedAmount;
      return (
        <>
          {p.paidAt ? `Paga em ${shortDate(p.paidAt)}` : 'Paga'} · {formatBRL(p.paidAmount || 0)}
          {p.plannedAmount > 0 && Math.abs(diff) >= 0.01 && (
            <span className={diff > 0 ? 'text-rose' : 'text-emerald'}> (previsto {formatBRL(p.plannedAmount)})</span>
          )}
        </>
      );
    }
    // Mapeamento em Resumo pago em parte
    const partial = p.paidAmount ? ` · ${formatBRL(p.paidAmount)} já pagos` : '';
    if (p.status === 'ATRASADA') {
      return (
        <span className="text-rose">
          Venceu {shortDate(p.date)} {p.paidAmount ? 'sem quitar' : 'sem registro'} · {formatBRL(p.plannedAmount)}
          {partial}
        </span>
      );
    }
    if (p.status === 'NAO_VAI') return `Não vai acontecer${p.note ? `: ${p.note}` : ''}`;
    if (p.status === 'TERCEIROS') return `Paga por ${p.note || 'outra pessoa'}`;
    return `Prevista para ${whenLabel({ date: p.date, overdue: false })} · ${formatBRL(p.plannedAmount)}${partial}`;
  };

  const groupSummary = (t: SpendingTotals) =>
    isFutureSpending
      ? `${t.total} ${t.total === 1 ? 'compra prevista' : 'compras previstas'} · ${formatBRL(t.planned)}`
      : `${t.done} de ${t.total} ${t.total === 1 ? 'feita' : 'feitas'} · ${formatBRL(t.spent)} de ${formatBRL(t.planned)}`;

  // ── Próximo recebimento ──
  const nextIncome = useMemo(
    () =>
      movements
        .filter((m) => m.type === 'RECEBER' && m.status === 'PREVISTA' && m.dueDate >= todayIso)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0],
    [movements, todayIso]
  );

  // ── Movimentações do período (entradas e saídas, previstas e realizadas) ──
  const [showPeriodMovements, setShowPeriodMovements] = useState(false);
  const periodRange = trackingPeriodRange(period);
  const periodMovements = useMemo(
    () =>
      movements.filter((m) => {
        if (m.status === 'CANCELADA') return false;
        const date = movementDate(m);
        return date >= periodRange.from && date <= periodRange.to;
      }),
    [movements, periodRange.from, periodRange.to]
  );
  const periodFlow = useMemo(() => {
    const sum = (income: boolean) =>
      periodMovements.filter((m) => isMovementIncome(m) === income).reduce((acc, m) => acc + movementValue(m), 0);
    const income = sum(true);
    const expense = sum(false);
    return { income, expense, net: income - expense };
  }, [periodMovements]);

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
      naturezas: userNatures(natures).length > 0 ? { text: `${userNatures(natures).length} naturezas`, tone: '' } : { text: 'Organize seus gastos', tone: 'invite' },
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
    { tab: 'EMPRESTIMOS', label: 'Contratos', icon: FileText, status: moduleStatus.emprestimos },
    { tab: 'OPORTUNIDADES', label: 'Oportunidades', icon: BadgePercent, status: { text: 'Preços em queda', tone: '' } },
    { tab: 'COMPARTILHADO', label: 'Planejamento conjunto', icon: Users, status: { text: 'Acompanhe com alguém', tone: 'invite' } },
  ];

  // Últimas solicitações à Forseti: pop-up pelo ícone ao lado da caixa de texto
  const [showActivity, setShowActivity] = useState(false);
  const cutoff = activityCutoffIso();
  const recentRequests = forsetiActivity.filter((a) => a.at >= cutoff).length;

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
        <GuidedSetup onFinished={() => setFinishedSetup(true)} />
      </div>
    );
  }

  return (
    <div className="home-hub">
      <header className="home-hub-header has-switch">
        <div>
          <h1>
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p>{today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <PlanningSwitcher onPlanWithOthers={onPlanWithOthers} />
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
        <button
          type="button"
          className="home-forseti-icon has-count"
          onClick={() => setShowActivity(true)}
          aria-label="Últimas solicitações à Forseti"
          title="Últimas solicitações à Forseti"
        >
          <History size={18} />
          {recentRequests > 0 && <span className="home-forseti-count">{recentRequests}</span>}
        </button>
        <button type="button" className="home-forseti-icon" onClick={onOpenForseti} aria-label="Enviar foto do cupom" title="Enviar foto do cupom">
          <Camera size={18} />
        </button>
        <button type="submit" className="home-forseti-icon is-send" aria-label="Enviar">
          <Send size={16} />
        </button>
      </form>
      <ForsetiActivityModal isOpen={showActivity} onClose={() => setShowActivity(false)} />

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
        <button type="button" className="home-stat is-clickable" onClick={() => setShowPeriodMovements(true)}>
          <span>Movimentações {labels.this}</span>
          <strong className={periodFlow.net < 0 ? 'text-rose' : 'text-emerald'}>{formatBRL(periodFlow.net)}</strong>
          <small>
            {formatBRL(periodFlow.income)} entra · {formatBRL(periodFlow.expense)} sai
          </small>
        </button>
      </div>
      <PeriodMovementsModal
        isOpen={showPeriodMovements}
        onClose={() => setShowPeriodMovements(false)}
        title={`Movimentações ${labels.this}`}
        subtitle={periodRangeLabel(period, periodRange)}
        movements={periodMovements}
      />

      {/* O que faço agora? */}
      <section className="home-card">
        <div className="home-card-head">
          <h2>Para fazer agora</h2>
          <span>
            {atRoot
              ? tasks.length > 0
                ? `${tasks.length} ${labels.this}`
                : ''
              : `${levelTasks.length} ${labels.this} · ${formatBRL(levelTasks.reduce((acc, e) => acc + e.amount, 0))}`}
          </span>
        </div>
        {openNature && (
          <nav className="home-task-trail" aria-label="Nível da lista">
            <button type="button" onClick={() => setDrill(openMapping ? { natureId: openNature.id } : null)} aria-label="Voltar um nível">
              <ChevronLeft size={15} />
            </button>
            <button type="button" onClick={() => setDrill(null)}>
              Naturezas
            </button>
            <ChevronRight size={12} aria-hidden="true" />
            {openMapping ? (
              <>
                <button type="button" onClick={() => setDrill({ natureId: openNature.id })}>
                  {openNature.icon} {openNature.name}
                </button>
                <ChevronRight size={12} aria-hidden="true" />
                <strong>{openMapping.name}</strong>
              </>
            ) : (
              <strong>
                {openNature.icon} {openNature.name}
              </strong>
            )}
          </nav>
        )}
        {tasks.length === 0 ? (
          <p className="home-empty">
            <CheckCircle2 size={16} className="text-emerald" /> Nada vencendo {labels.this}.
          </p>
        ) : (
          <ul className="home-task-list">
            {visibleRows.map((row) =>
              row.type === 'GROUP' ? (
                <li key={`g_${row.id}`} className={`home-task-group ${row.overdue ? 'is-overdue' : ''}`}>
                  <button type="button" className="home-task-drill" onClick={row.open}>
                    <div className="home-task-main">
                      <span className="home-task-title">{row.title}</span>
                      <span className="home-task-meta">
                        {row.overdue ? `vencidos desde ${shortDate(row.date)}` : `a partir de ${whenLabel(row)}`} · {row.count}{' '}
                        {row.count === 1 ? 'item' : 'itens'} · <span className="text-rose">{formatBRL(row.amount)}</span>
                      </span>
                    </div>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </li>
              ) : (
                <li key={row.entry.id} className={row.entry.overdue ? 'is-overdue' : ''}>
                  <div className="home-task-main">
                    <span className="home-task-title">{row.entry.title}</span>
                    <span className="home-task-meta">
                      {whenLabel(row.entry)} ·{' '}
                      <span className={row.entry.kind === 'ENTRADA' ? 'text-emerald' : 'text-rose'}>{formatBRL(row.entry.amount)}</span>
                    </span>
                  </div>
                  {renderTaskAction(row.entry)}
                </li>
              )
            )}
          </ul>
        )}
        {atRoot && taskRows.length > 4 && (
          <button type="button" className="link-button" onClick={() => setShowAllTasks((v) => !v)}>
            {showAllTasks ? 'Mostrar menos' : `Ver todas (${taskRows.length})`}
          </button>
        )}
      </section>

      {/* Como vão os gastos no período? */}
      <section className="home-card">
        <div className="home-card-head">
          <h2>{isFutureSpending ? `Gastos previstos ${labels.that}` : `Gastos ${spendingWhen}`}</h2>
          <div className="home-period-switch" role="group" aria-label="Período de acompanhamento">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                className={p === period ? 'is-active' : ''}
                onClick={() => {
                  setViewPreferences({ trackingPeriod: p });
                  goToSpending(0);
                }}
              >
                {TRACKING_PERIOD_LABELS[p].name}
              </button>
            ))}
          </div>
        </div>
        <div className="home-period-nav">
          <button
            type="button"
            onClick={() => goToSpending(spendingOffset - 1)}
            disabled={atSpendingStart}
            aria-label={`${labels.name} anterior`}
            title={atSpendingStart ? 'Início do marco: não há lançamentos antes dele' : `${labels.name} anterior`}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="home-period-label">
            {periodRangeLabel(period, spendingRange)}
            {isCurrentSpending ? (
              <small>atual</small>
            ) : (
              <button type="button" className="link-button" onClick={() => goToSpending(0)}>
                Voltar para a atual
              </button>
            )}
          </span>
          <button type="button" onClick={() => goToSpending(spendingOffset + 1)} aria-label={nextPeriodLabel} title={nextPeriodLabel}>
            <ChevronRight size={16} />
          </button>
        </div>
        {periodItems.length === 0 ? (
          <p className="home-empty">
            {isFutureSpending ? `Nenhuma compra prevista ${labels.that}.` : `Nenhuma compra prevista ou registrada ${spendingWhen}.`}
          </p>
        ) : (
          <>
            <p className="home-spending-summary">
              {isFutureSpending ? (
                <>
                  <strong>{formatBRL(spendingTotals.planned)}</strong> previstos em {spendingTotals.total}{' '}
                  {spendingTotals.total === 1 ? 'compra' : 'compras'}
                </>
              ) : (
                <>
                  <strong>{formatBRL(spendingTotals.spent)}</strong> gastos de {formatBRL(spendingTotals.planned)} previstos ·{' '}
                  {spendingTotals.done} de {spendingTotals.total} compras feitas
                  {spendingTotals.overdue > 0 && (
                    <span className="text-rose">
                      {' '}
                      · {spendingTotals.overdue} {spendingTotals.overdue === 1 ? 'item atrasado' : 'itens atrasados'}
                    </span>
                  )}
                </>
              )}
            </p>
            {openSpendingNature && (
              <nav className="home-task-trail" aria-label="Nível da lista de gastos">
                <button type="button" onClick={() => setSpendingNatureId(null)} aria-label="Voltar para as naturezas">
                  <ChevronLeft size={15} />
                </button>
                <button type="button" onClick={() => setSpendingNatureId(null)}>
                  Naturezas
                </button>
                <ChevronRight size={12} aria-hidden="true" />
                <strong>
                  {openSpendingNature.icon} {openSpendingNature.name}
                </strong>
              </nav>
            )}
            <ul className="home-task-list">
              {visibleSpendingRows.map((row) => {
                if (row.type === 'NATURE') {
                  const t = sumItems(row.items);
                  return (
                    <li key={`n_${row.id}`} className={`home-task-group ${row.overdue ? 'is-overdue' : ''}`}>
                      <button
                        type="button"
                        className="home-task-drill"
                        onClick={() => {
                          setSpendingNatureId(row.id);
                          setExpandedItemId(null);
                        }}
                      >
                        <div className="home-task-main">
                          <span className="home-task-title">{row.title}</span>
                          <span className="home-task-meta">
                            {groupSummary(t)}
                            {t.nextDate && ` · próxima ${whenLabel({ date: t.nextDate, overdue: false })}`}
                          </span>
                        </div>
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    </li>
                  );
                }
                const { item } = row;
                if (item.purchases.length === 1) {
                  const only = item.purchases[0];
                  return (
                    <li key={`i_${item.id}`} className={item.overdue ? 'is-overdue' : ''}>
                      <div className="home-task-main">
                        <span className="home-task-title">{item.title}</span>
                        <span className="home-task-meta">{describePurchase(only)}</span>
                      </div>
                      <span className={`home-purchase-pill is-${only.status.toLowerCase()}`}>{PURCHASE_PILL[only.status]}</span>
                    </li>
                  );
                }
                // Item com várias compras no período: resumo que abre a lista de datas
                const expanded = expandedItemId === item.id;
                const itemPill = item.total > 0 && item.done === item.total ? 'is-feita' : item.overdue ? 'is-atrasada' : 'is-prevista';
                return (
                  <li key={`i_${item.id}`} className={`home-purchase-item ${item.overdue ? 'is-overdue' : ''}`}>
                    <button
                      type="button"
                      className="home-task-drill"
                      onClick={() => setExpandedItemId(expanded ? null : item.id)}
                      aria-expanded={expanded}
                    >
                      <div className="home-task-main">
                        <span className="home-task-title">{item.title}</span>
                        <span className="home-task-meta">
                          {groupSummary(sumItems([item]))}
                          {item.nextDate && ` · próxima ${whenLabel({ date: item.nextDate, overdue: false })}`}
                        </span>
                      </div>
                      <span className={`home-purchase-pill ${itemPill}`}>
                        {item.done}/{item.total}
                      </span>
                      <ChevronRight size={16} aria-hidden="true" className={`home-purchase-chevron ${expanded ? 'is-open' : ''}`} />
                    </button>
                    {expanded && (
                      <ul className="home-purchase-list">
                        {item.purchases.map((p) => (
                          <li key={p.key}>
                            <span className="home-purchase-date">{shortDate(p.date)}</span>
                            <span className="home-task-meta">{describePurchase(p)}</span>
                            <span className={`home-purchase-pill is-${p.status.toLowerCase()}`}>{PURCHASE_PILL[p.status]}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
            {!openSpendingNature && spendingRows.length > 5 && (
              <button type="button" className="link-button" onClick={() => setShowAllSpending((v) => !v)}>
                {showAllSpending ? 'Mostrar menos' : `Ver todas (${spendingRows.length})`}
              </button>
            )}
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

      <MappingPaymentModal target={mappingPayment} onClose={() => setMappingPayment(null)} />
      <RealizationConfirmModal target={realization} onClose={() => setRealization(null)} />
    </div>
  );
};
