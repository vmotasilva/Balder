import React, { useState } from 'react';
import { ThumbsDown, ThumbsUp, Undo2 } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';
import { FORSETI_ACTIVITY_HOURS, activityCutoffIso } from '../services/forsetiActivityService';
import { canUndoActivity, createdMovementsOf } from '../utils/forsetiAssistant';
import type { ForsetiActivity, ForsetiActivityKind } from '../types';

const KIND_ICON: Record<ForsetiActivityKind, string> = {
  PAGAMENTO: '💸',
  RECEBIMENTO: '💰',
  CARTAO: '💳',
  CUPOM: '🧾',
  FATURA: '🧾',
  DUVIDA: '❓',
  CONVERSA: '💬',
};

/** Mostra a resposta como apareceu na conversa: quebras de linha e **negrito**. */
const renderBold = (text: string) =>
  text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>));

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
 * e desfazer o que foi lançado. Guarda só as últimas FORSETI_ACTIVITY_HOURS horas. Abre pelo ícone ao lado
 * da caixa de texto da Forseti.
 */
export const ForsetiActivityModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { forsetiActivity: allActivity, movements, rateForsetiActivity, undoForsetiActivity } = useFinancial();
  // Com o app aberto por muito tempo, o que passou do período some da lista (e do armazenamento no próximo carregamento)
  const cutoff = activityCutoffIso();
  // As conversas completas são guardadas só para estudo da Forseti; aqui ficam os desfechos
  const forsetiActivity = allActivity.filter((a) => a.at >= cutoff && a.kind !== 'CONVERSA');
  const { confirm, dialogProps } = useConfirmDialog();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Últimas solicitações à Forseti"
      subtitle={`Últimas ${FORSETI_ACTIVITY_HOURS} horas · avalie a resposta ou desfaça um lançamento`}
      maxWidth="560px"
    >
      {forsetiActivity.length === 0 ? (
        <p className="home-empty">Nada pedido à Forseti nas últimas {FORSETI_ACTIVITY_HOURS} horas. O que você pedir aparece aqui, para avaliar a resposta ou desfazer um lançamento.</p>
      ) : (
        <ul className="home-task-list forseti-activity-list">
          {forsetiActivity.map((a) => (
            <li key={a.id} className={a.undoneAt ? 'is-undone' : ''}>
              <span className="forseti-activity-icon" aria-hidden="true">
                {KIND_ICON[a.kind]}
              </span>
              <div className="home-task-main">
                <span className="home-task-title" title={a.request}>
                  “{a.request}”
                </span>
                <span className="forseti-activity-result">{renderBold(a.result)}</span>
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
      <ConfirmDialog {...dialogProps} />
    </Modal>
  );
};
