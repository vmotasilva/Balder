import React, { useState } from 'react';
import { ThumbsDown, ThumbsUp, Undo2 } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { FORSETI_ACTIVITY_DAYS } from '../services/forsetiActivityService';
import { canUndoActivity, createdMovementsOf } from '../utils/forsetiAssistant';
import type { ForsetiActivity, ForsetiActivityKind } from '../types';

const KIND_ICON: Record<ForsetiActivityKind, string> = {
  PAGAMENTO: '💸',
  RECEBIMENTO: '💰',
  CARTAO: '💳',
  CUPOM: '🧾',
  FATURA: '🧾',
  DUVIDA: '❓',
};

const whenLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000
  );
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `hoje, ${time}`;
  if (days === 1) return `ontem, ${time}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${time}`;
};

/**
 * Últimas solicitações feitas à Forseti: o que foi pedido, o que ela fez, avaliação (ajudou / não ajudou)
 * e desfazer o que foi lançado. Guarda os últimos FORSETI_ACTIVITY_DAYS dias.
 */
export const ForsetiActivityCard: React.FC = () => {
  const { forsetiActivity, movements, rateForsetiActivity, undoForsetiActivity } = useFinancial();
  const { confirm, dialogProps } = useConfirmDialog();
  const [showAll, setShowAll] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const visible = showAll ? forsetiActivity : forsetiActivity.slice(0, 4);

  const askUndo = (a: ForsetiActivity) => {
    const created = createdMovementsOf(a, movements);
    const lines = [
      created.length > 0 ? `${created.length} lançamento${created.length > 1 ? 's' : ''} (${created[0].title}${created.length > 1 ? '…' : ''})` : '',
      a.cardName ? `o cartão ${a.cardName}` : '',
    ].filter(Boolean);
    confirm({
      title: 'Desfazer esta solicitação?',
      message: `Pedido: "${a.request}". Vou apagar ${lines.join(' e ') || 'o que ela criou'}. Isso não pode ser revertido.`,
      confirmLabel: 'Desfazer',
      onConfirm: () => setFeedback(undoForsetiActivity(a.id)),
    });
  };

  const rate = (a: ForsetiActivity, rating: NonNullable<ForsetiActivity['rating']>) =>
    rateForsetiActivity(a.id, a.rating === rating ? undefined : rating);

  return (
    <section className="home-card">
      <div className="home-card-head">
        <h2>Últimas solicitações à Forseti</h2>
        <span>últimos {FORSETI_ACTIVITY_DAYS} dias</span>
      </div>
      {forsetiActivity.length === 0 ? (
        <p className="home-empty">O que você pedir à Forseti aparece aqui, para avaliar a resposta ou desfazer um lançamento.</p>
      ) : (
        <ul className="home-task-list forseti-activity-list">
          {visible.map((a) => (
            <li key={a.id} className={a.undoneAt ? 'is-undone' : ''}>
              <span className="forseti-activity-icon" aria-hidden="true">
                {KIND_ICON[a.kind]}
              </span>
              <div className="home-task-main">
                <span className="home-task-title" title={a.request}>
                  “{a.request}”
                </span>
                <span className="forseti-activity-result">{a.result}</span>
                <span className="home-task-meta">
                  {whenLabel(a.at)}
                  {a.planOwnerName ? ` · planejamento de ${a.planOwnerName}` : ''}
                  {a.undoneAt ? ' · desfeito' : ''}
                </span>
              </div>
              <div className="forseti-activity-actions">
                <button
                  type="button"
                  className={`forseti-rate ${a.rating === 'UTIL' ? 'is-up' : ''}`}
                  aria-pressed={a.rating === 'UTIL'}
                  aria-label="Ajudou"
                  title="Ajudou"
                  onClick={() => rate(a, 'UTIL')}
                >
                  <ThumbsUp size={14} />
                </button>
                <button
                  type="button"
                  className={`forseti-rate ${a.rating === 'NAO_UTIL' ? 'is-down' : ''}`}
                  aria-pressed={a.rating === 'NAO_UTIL'}
                  aria-label="Não ajudou"
                  title="Não ajudou"
                  onClick={() => rate(a, 'NAO_UTIL')}
                >
                  <ThumbsDown size={14} />
                </button>
                {canUndoActivity(a) && (
                  <button type="button" className="btn btn-outline btn-xs" onClick={() => askUndo(a)}>
                    <Undo2 size={13} /> Desfazer
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {feedback && <p className={`forseti-activity-feedback ${feedback.ok ? 'text-emerald' : 'text-rose'}`}>{feedback.message}</p>}
      {forsetiActivity.length > 4 && (
        <button type="button" className="link-button" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Mostrar menos' : `Ver todas (${forsetiActivity.length})`}
        </button>
      )}
      <ConfirmDialog {...dialogProps} />
    </section>
  );
};
