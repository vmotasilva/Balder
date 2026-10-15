import React, { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, BadgePercent, CalendarClock, Flag, HandCoins, Sparkles, TrendingDown } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { useAuth } from '../context/AuthContext';
import { usePlans, scopedUserId } from '../context/PlanScopeContext';
import { useOpportunities } from './useOpportunities';
import { OPPORTUNITY_LABEL, watchStats } from '../utils/opportunity';
import { compactDigest } from '../utils/forsetiDigest';
import { displayName } from '../utils/displayName';

export interface HubNotification {
  /** Muda quando a situação muda (ex.: outra conta vence): assim volta a contar como não lida. */
  id: string;
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  timestamp: string;
  actionLabel?: string;
  action?: () => void;
  icon?: React.ReactNode;
}

export interface HubNotificationActions {
  onOpenSetup: (stepIndex?: number) => void;
  onGoToHome: () => void;
  onOpenForecast: (period?: 'DIAS_30') => void;
  onOpenOpportunities?: () => void;
  /** Abre a Forseti já com o resumo completo do dia. */
  onOpenDigest?: () => void;
}

interface StoredState {
  dismissed: string[];
  seen: string[];
}

const MAX_STORED = 200;

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Assinatura curta de um conjunto de lançamentos, para o id acompanhar a situação. */
const signature = (parts: string[]) => {
  let h = 0;
  for (const ch of [...parts].sort().join('|')) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
};

/**
 * Notificações da Central: só o que pede ação agora (contas atrasadas, recebimentos a confirmar,
 * vencimentos próximos, saldo previsto negativo e ponto de partida ausente). O número do sino conta
 * apenas as não lidas: abrir a Central marca como lidas e limpar dispensa; uma situação nova volta a contar.
 */
export function useHubNotifications(actions: HubNotificationActions) {
  const { user } = useAuth();
  const { activePlanId } = usePlans();
  const { activeCheckpoint, availableBalance, forecasts, forsetiMemories, isDataReady, viewPreferences } = useFinancial();
  const { watches } = useOpportunities();
  const storageKey = `balder_notifications_${user && !user.isGuest ? scopedUserId(user.$id, activePlanId) : 'guest'}`;

  const [stored, setStored] = useState<StoredState>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return { dismissed: parsed?.dismissed || [], seen: parsed?.seen || [] };
    } catch {
      return { dismissed: [], seen: [] };
    }
  });

  const notifications = useMemo<HubNotification[]>(() => {
    if (!isDataReady) return [];
    const list: HubNotification[] = [];
    const todayIso = isoOf(new Date());
    const in3Days = isoOf(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));

    // Sem ponto de partida nada do saldo fecha: é o único aviso de configuração
    if (!activeCheckpoint) {
      list.push({
        id: 'setup_checkpoint',
        type: 'CRITICAL',
        title: 'Defina seu ponto de partida',
        description: 'Sem ele a Forseti não consegue calcular seu saldo nem projetar os próximos meses.',
        timestamp: 'Configuração',
        actionLabel: 'Definir com a Forseti',
        action: () => actions.onOpenSetup(1),
        icon: <Flag size={16} className="text-rose" />,
      });
    }

    const entries = forecasts.DIAS_30?.entries || [];

    // Contas a pagar: atrasadas e a vencer em até 3 dias num só aviso (é o mesmo assunto e o mesmo destino)
    const overdueOut = entries.filter((e) => e.overdue && e.kind === 'SAIDA');
    const dueSoon = entries.filter((e) => !e.overdue && e.kind === 'SAIDA' && e.date >= todayIso && e.date <= in3Days);
    if (overdueOut.length > 0 || dueSoon.length > 0) {
      const sum = (list: typeof entries) => list.reduce((acc, e) => acc + e.amount, 0);
      const dueToday = dueSoon.some((e) => e.date === todayIso);
      const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
      const parts: string[] = [];
      if (overdueOut.length > 0) {
        const oldest = overdueOut.reduce((min, e) => (e.date < min ? e.date : min), overdueOut[0].date);
        parts.push(`${formatBRL(sum(overdueOut))} em aberto, ${plural(overdueOut.length, 'desde', 'a mais antiga desde')} ${ddmm(oldest)}`);
      }
      if (dueSoon.length > 0) parts.push(`${formatBRL(sum(dueSoon))} a pagar até ${ddmm(in3Days)}`);

      let title: string;
      if (overdueOut.length > 0 && dueSoon.length > 0) {
        title = `${overdueOut.length} ${plural(overdueOut.length, 'conta atrasada', 'contas atrasadas')} e ${dueSoon.length} ${plural(dueSoon.length, 'vence', 'vencem')} até ${ddmm(in3Days)}`;
      } else if (overdueOut.length > 0) {
        title = overdueOut.length === 1 ? `Conta atrasada: ${overdueOut[0].title}` : `${overdueOut.length} contas atrasadas`;
      } else {
        title =
          dueSoon.length === 1
            ? `Vence ${dueToday ? 'hoje' : `em ${ddmm(dueSoon[0].date)}`}: ${dueSoon[0].title}`
            : `${dueSoon.length} contas vencem até ${ddmm(in3Days)}`;
      }
      const critical = overdueOut.length > 0 || dueToday;
      list.push({
        id: `bills_${signature([...overdueOut, ...dueSoon].map((e) => `${e.id}@${e.date}`))}`,
        type: critical ? 'CRITICAL' : 'WARNING',
        title,
        description: `${parts.join('. ')}.${overdueOut.length > 0 ? ' Se já pagou, confirme para o saldo ficar certo.' : ''}`,
        timestamp: overdueOut.length > 0 ? 'Atrasado' : dueToday ? 'Hoje' : 'Próximos 3 dias',
        actionLabel: 'Ver no Início',
        action: actions.onGoToHome,
        icon: critical ? <AlertTriangle size={16} className="text-rose" /> : <CalendarClock size={16} className="text-amber" />,
      });
    }

    // Recebimentos que já deveriam ter entrado
    const overdueIn = entries.filter((e) => e.overdue && e.kind === 'ENTRADA');
    if (overdueIn.length > 0) {
      const total = overdueIn.reduce((acc, e) => acc + e.amount, 0);
      list.push({
        id: `overdue_in_${signature(overdueIn.map((e) => `${e.id}@${e.date}`))}`,
        type: 'WARNING',
        title:
          overdueIn.length === 1 ? `Recebimento a confirmar: ${overdueIn[0].title}` : `${overdueIn.length} recebimentos a confirmar`,
        description: `${formatBRL(total)} previstos até hoje. Já entrou? Confirme para manter o saldo certo.`,
        timestamp: 'A confirmar',
        actionLabel: 'Confirmar no Início',
        action: actions.onGoToHome,
        icon: <HandCoins size={16} className="text-amber" />,
      });
    }

    // Saldo previsto negativo em 30 dias
    const window30 = forecasts.DIAS_30;
    if (activeCheckpoint && window30 && window30.projectedBalance < 0) {
      list.push({
        id: `negative_30d_${Math.round(window30.projectedBalance / 100)}`,
        type: 'CRITICAL',
        title: 'Saldo previsto negativo',
        description: `Com o que está previsto, seu saldo chega a ${formatBRL(window30.projectedBalance)} até ${ddmm(window30.toDate)}.`,
        timestamp: 'Próximos 30 dias',
        actionLabel: 'Ver o que compõe',
        action: () => actions.onOpenForecast('DIAS_30'),
        icon: <TrendingDown size={16} className="text-rose" />,
      });
    }

    // Resumo do dia: uma notificação por dia (o id muda na virada, então volta a contar como não lida)
    if (activeCheckpoint && forecasts.DIAS_30 && forecasts.MES) {
      const digest = compactDigest(
        { availableBalance, forecasts, memories: forsetiMemories },
        new Date(),
        displayName(user?.name, viewPreferences)
      );
      list.push({
        id: `digest_${todayIso}`,
        type: 'INFO',
        title: digest.title,
        description: digest.description,
        timestamp: 'Hoje',
        actionLabel: 'Ver o resumo completo',
        action: actions.onOpenDigest,
        icon: <Sparkles size={16} className="text-cyan" />,
      });
    }

    // Produtos acompanhados que viraram oportunidade (o id muda com o preço: nova queda volta a avisar)
    watches.forEach((w) => {
      const s = watchStats(w);
      if (!s.opportunity || w.currentPrice == null) return;
      list.push({
        id: `opportunity_${w.id}_${w.currentPrice}`,
        type: 'INFO',
        title: `${OPPORTUNITY_LABEL[s.opportunity]}: ${w.title.length > 60 ? `${w.title.slice(0, 57)}…` : w.title}`,
        description: `Agora por ${formatBRL(w.currentPrice)}${w.store ? ` na ${w.store}` : ''}. ${s.reason || ''}`.trim(),
        timestamp: 'Oportunidade',
        actionLabel: 'Ver oportunidade',
        action: actions.onOpenOpportunities,
        icon: <BadgePercent size={16} className="text-emerald" />,
      });
    });

    return list;
    // As ações vêm de callbacks estáveis o bastante; recalcula só quando os dados mudam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataReady, activeCheckpoint, availableBalance, forecasts, forsetiMemories, viewPreferences, user, watches]);

  const currentIds = useMemo(() => notifications.map((n) => n.id), [notifications]);

  const persist = useCallback(
    (next: StoredState) => {
      // Só os mais recentes: os dados carregam em etapas, então não dá para podar pelo que existe agora
      const recent = (ids: string[]) => Array.from(new Set(ids)).slice(-MAX_STORED);
      const trimmed = { dismissed: recent(next.dismissed), seen: recent(next.seen) };
      setStored(trimmed);
      try {
        localStorage.setItem(storageKey, JSON.stringify(trimmed));
      } catch {
        // sem armazenamento: vale só nesta sessão
      }
    },
    [storageKey]
  );

  const visible = notifications.filter((n) => !stored.dismissed.includes(n.id));
  const unreadCount = visible.filter((n) => !stored.seen.includes(n.id)).length;

  return {
    notifications: visible,
    unreadCount,
    hasDismissed: stored.dismissed.length > 0,
    markAllSeen: () => persist({ ...stored, seen: Array.from(new Set([...stored.seen, ...currentIds])) }),
    dismiss: (id: string) => persist({ ...stored, dismissed: [...stored.dismissed, id] }),
    dismissAll: () => persist({ dismissed: [...currentIds], seen: [...currentIds] }),
    restoreDismissed: () => persist({ ...stored, dismissed: [] }),
  };
}
