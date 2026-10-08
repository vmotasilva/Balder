import React, { useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Camera,
  History,
  Image as ImageIcon,
  Mic,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Target,
  Wallet,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { useAuth } from '../context/AuthContext';
import { usePlans, scopedUserId } from '../context/PlanScopeContext';
import { useAccountScope } from '../context/AccountScopeContext';
import { GuidedSetup } from '../components/GuidedSetup';
import { NatureBudgetGrid } from '../components/NatureBudgetGrid';
import { GoalsOverview } from '../components/GoalsOverview';
import { BalanceBreakdownModal } from '../components/BalanceBreakdownModal';
import { ForecastBreakdownModal } from '../components/ForecastBreakdownModal';
import { Modal } from '../components/Modal';
import { SalaryOverview } from '../components/SalaryOverview';
import { ForsetiActivityModal } from '../components/ForsetiActivityModal';
import { activityCutoffIso } from '../services/forsetiActivityService';
import { PlanningSwitcher } from '../components/PlanningSwitcher';
import type { TabId } from '../components/Sidebar';
import { periodRangeLabel, trackingPeriodRange, TRACKING_PERIOD_LABELS } from '../utils/periodSpending';
import type { TrackingPeriod } from '../utils/periodSpending';
import { getItemOccurrences } from '../utils/mappingItemState';
import { MappingItemStateModal, type MappingItemStateTarget } from '../components/MappingItemStateModal';
import { MappingPaymentModal, type MappingPaymentTarget } from '../components/MappingPaymentModal';
import { RealizationConfirmModal, realizedMovementUpdates, type RealizationTarget } from '../components/RealizationConfirmModal';
import type { ForecastEntry } from '../utils/forecastWindow';
import { displayName } from '../utils/displayName';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { PeriodMovementsModal, isMovementIncome, movementDate, movementValue } from '../components/PeriodMovementsModal';

interface HomeHubPageProps {
  onNavigate: (tab: TabId) => void;
  /** Abre o chat da Forseti; `draft` já vem escrito no campo de mensagem (ex.: texto ditado). */
  onOpenForseti: (draft?: string) => void;
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

/**
 * Início: o hub do Balder. Responde "o que aconteceu?" (Forseti), "como estou?" (3 números),
 * "o que faço agora?" (tarefas do período), "como vão os gastos?" (Naturezas)
 * e "para onde vou?" (módulos com status). Para quem ainda não configurou, mostra a conversa guiada.
 */
export const HomeHubPage: React.FC<HomeHubPageProps> = ({ onNavigate, onOpenForseti, onPlanWithOthers }) => {
  const { user } = useAuth();
  const { activePlanId, activePlan } = usePlans();
  const {
    isDataReady,
    activeCheckpoint,
    movements,
    natures,
    forecasts,
    availableBalance,
    accountBalance,
    cashInHandBalance,
    viewPreferences,
    setViewPreferences,
    updateMovement,
    updateMappingItemState,
    sendMessageToCopilot,
    forsetiActivity,
    sharedScenario,
  } = useFinancial();
  const { viewing } = useAccountScope();

  const [forsetiText, setForsetiText] = useState('');
  const [showAllTasks, setShowAllTasks] = useState(false);
  // Níveis da lista: naturezas → mapeamentos da natureza → itens do mapeamento
  const [drill, setDrill] = useState<{ natureId: string; mappingId?: string } | null>(null);
  const [mappingPayment, setMappingPayment] = useState<MappingPaymentTarget | null>(null);
  const [realization, setRealization] = useState<RealizationTarget | null>(null);
  const [finishedSetup, setFinishedSetup] = useState(false);
  // No celular, "Em aberto" e "Naturezas" dividem o mesmo espaço, em abas
  const [homePane, setHomePane] = useState<'FAZER' | 'NATUREZAS'>('FAZER');
  // Metas e Salário abrem em pop-up, pelos ícones ao lado do período
  const [showGoals, setShowGoals] = useState(false);
  const [itemState, setItemState] = useState<MappingItemStateTarget | null>(null);
  const [showSalary, setShowSalary] = useState(false);

  const period: TrackingPeriod = viewPreferences.trackingPeriod || 'MES';
  const labels = TRACKING_PERIOD_LABELS[period];
  const today = new Date();
  const todayIso = isoOf(today);
  const firstName = displayName(user?.name, viewPreferences);

  const onboardingDone = (() => {
    try {
      return localStorage.getItem(user && !user.isGuest ? `balder_onboarding_completed_${scopedUserId(user.$id, activePlanId)}` : 'balder_onboarding_completed_guest') === 'true';
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
    // Fatura: confirma o pagamento aqui mesmo (valor e data conferidos no pop-up), sem sair da Home
    if (entry.source === 'FATURA') {
      const invoice = movements.find((m) => m.id === entry.id);
      return (
        <button
          type="button"
          className="btn btn-outline btn-xs"
          onClick={() =>
            invoice
              ? setRealization({
                  kind: 'SAIDA',
                  title: entry.title,
                  expectedAmount: invoice.amount,
                  dueDate: invoice.dueDate,
                  onConfirm: (amount, date) => updateMovement(invoice.id, realizedMovementUpdates(invoice, amount, date)),
                })
              : onNavigate('FATURAS')
          }
        >
          Já paguei
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
      // Sem atalho direto: abre o pop-up do item, para dizer como foi tratado (realizado, quem pagou, pular)
      return (
        <button
          type="button"
          className="btn btn-outline btn-xs"
          onClick={() =>
            found
              ? setItemState({ natureId: found.nat.id, mappingId: found.mapping.id, itemId: found.item.id, monthKey, occurrenceDate: entry.date })
              : onNavigate('NATUREZAS')
          }
        >
          Lançar
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
  const [showForecast, setShowForecast] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
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

  // Câmera: pergunta se tira a foto agora ou usa uma imagem existente e já envia à Forseti
  const [showPhotoChoice, setShowPhotoChoice] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (files.length === 0) return;
    const attachments = files.map((file) => {
      const url = URL.createObjectURL(file);
      return {
        url,
        name: file.name || 'comprovante.jpg',
        size: file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`,
        revoke: () => URL.revokeObjectURL(url),
      };
    });
    sendMessageToCopilot(forsetiText.trim(), attachments);
    setForsetiText('');
    onOpenForseti();
  };

  // Voz: a caixa acompanha o que é dito; ao terminar, o chat abre com o texto no campo de escrita
  const voice = useSpeechRecognition({
    onInterim: setForsetiText,
    onFinal: (text) => {
      setForsetiText('');
      onOpenForseti(text);
    },
  });

  if (!isDataReady) {
    return <div className="home-hub"><p className="text-sm text-muted">Carregando…</p></div>;
  }

  if (needsSetup) {
    return (
      <div className="home-hub">
        <header className={`home-hub-header ${activePlanId ? 'has-switch' : ''}`}>
          <div>
            <h1>{firstName ? `Bem-vindo, ${firstName}` : 'Bem-vindo ao Balder'}</h1>
            <p>
              {activePlan
                ? `Vamos começar o planejamento "${activePlan.name}", separado do seu principal. Leva uns 3 minutos.`
                : 'Leva uns 3 minutos. Você pode mudar tudo depois.'}
            </p>
          </div>
          {/* Num planejamento extra novo é preciso poder voltar ao principal sem terminar o início */}
          {activePlanId && <PlanningSwitcher onPlanWithOthers={onPlanWithOthers} />}
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
          // Tocar na caixa abre o chat da Forseti; sai do foco para não reabrir ao fechar o pop-up
          onFocus={(e) => {
            e.currentTarget.blur();
            onOpenForseti();
          }}
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
        {voice.supported && (
          <button
            type="button"
            className={`home-forseti-icon ${voice.listening ? 'is-listening' : ''}`}
            onClick={voice.toggle}
            aria-label={voice.listening ? 'Parar de ouvir' : 'Falar com a Forseti'}
            title={voice.listening ? 'Ouvindo… toque para parar' : 'Falar com a Forseti'}
          >
            <Mic size={18} />
          </button>
        )}
        <button
          type="button"
          className="home-forseti-icon"
          onClick={() => setShowPhotoChoice(true)}
          aria-label="Enviar foto do cupom"
          title="Enviar foto do cupom"
        >
          <Camera size={18} />
        </button>
      </form>
      {voice.error && <p className="text-xs text-rose" role="alert">{voice.error}</p>}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoPicked} style={{ display: 'none' }} />
      <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handlePhotoPicked} style={{ display: 'none' }} />
      <Modal isOpen={showPhotoChoice} onClose={() => setShowPhotoChoice(false)} title="Enviar foto do cupom" maxWidth="420px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setShowPhotoChoice(false);
              cameraInputRef.current?.click();
            }}
          >
            <Camera size={16} /> Tirar foto agora
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setShowPhotoChoice(false);
              galleryInputRef.current?.click();
            }}
          >
            <ImageIcon size={16} /> Escolher imagem existente
          </button>
        </div>
      </Modal>
      <ForsetiActivityModal isOpen={showActivity} onClose={() => setShowActivity(false)} />

      {/* Como estou? */}
      <div className="home-stats">
        <button type="button" className="home-stat is-clickable" onClick={() => setShowBalance(true)}>
          <span>Saldo hoje</span>
          <strong>{formatBRL(availableBalance)}</strong>
          <small>
            {formatBRL(accountBalance)} em conta · {formatBRL(cashInHandBalance)} em mãos
          </small>
        </button>
        <BalanceBreakdownModal isOpen={showBalance} onClose={() => setShowBalance(false)} />
        <button type="button" className="home-stat is-clickable" onClick={() => setShowForecast(true)}>
          <span>Previsto {labels.end}</span>
          <strong className={periodWindow.projectedBalance < 0 ? 'text-rose' : 'text-emerald'}>{formatBRL(periodWindow.projectedBalance)}</strong>
        </button>
        <ForecastBreakdownModal
          isOpen={showForecast}
          onClose={() => setShowForecast(false)}
          period={period}
          onPeriodChange={(p) => p !== 'DIAS_30' && setViewPreferences({ trackingPeriod: p })}
        />
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

      {/* Período: vale para os dois cards */}
      <div className="home-period-bar">
        <div className="home-period-switch" role="group" aria-label="Período de acompanhamento">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className={p === period ? 'is-active' : ''}
              onClick={() => setViewPreferences({ trackingPeriod: p })}
            >
              {TRACKING_PERIOD_LABELS[p].name}
            </button>
          ))}
        </div>
        <button type="button" className="home-period-icon" onClick={() => setShowGoals(true)} aria-label="Metas" title="Metas">
          <Target size={16} />
        </button>
        <button type="button" className="home-period-icon" onClick={() => setShowSalary(true)} aria-label="Salário" title="Salário">
          <Wallet size={16} />
        </button>
      </div>
      <Modal isOpen={showGoals} onClose={() => setShowGoals(false)} title="Metas" maxWidth="640px">
        <GoalsOverview
          onNavigateToGoals={() => {
            setShowGoals(false);
            onNavigate('METAS');
          }}
        />
      </Modal>
      <Modal isOpen={showSalary} onClose={() => setShowSalary(false)} title="Salário" maxWidth="640px">
        <SalaryOverview />
      </Modal>

      {/* No computador, os três cards ficam lado a lado e cabem na tela */}
      <div className="home-columns" data-pane={homePane}>
      <div className="home-tabs home-tabs-mobile" role="tablist" aria-label="Seções do Início">
        {([
          ['FAZER', `Em aberto${tasks.length > 0 ? ` · ${tasks.length}` : ''}`],
          ['NATUREZAS', 'Naturezas'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={homePane === id} className={homePane === id ? 'is-active' : ''} onClick={() => setHomePane(id)}>
            {label}
          </button>
        ))}
      </div>
      {/* O que faço agora? */}
      <section className="home-card home-pane-fazer">
        <div className="home-card-head">
          <h2>Em aberto</h2>
          <span>
            {atRoot
              ? tasks.length > 0
                ? `${tasks.length} ${labels.this}`
                : ''
              : `${levelTasks.length} ${labels.this} · ${formatBRL(levelTasks.reduce((acc, e) => acc + e.amount, 0))}`}
          </span>
        </div>
        <div className="home-card-scroll">
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
        </div>
      </section>

      <div className="home-right">
      <section className="home-card home-pane-naturezas">
        <NatureBudgetGrid onNavigateToNatures={() => onNavigate('NATUREZAS')} />
      </section>
      </div>
      </div>

      <MappingItemStateModal target={itemState} onClose={() => setItemState(null)} />
      <MappingPaymentModal target={mappingPayment} onClose={() => setMappingPayment(null)} />
      <RealizationConfirmModal target={realization} onClose={() => setRealization(null)} />
    </div>
  );
};
