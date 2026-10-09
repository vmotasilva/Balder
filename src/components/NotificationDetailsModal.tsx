import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Modal } from './Modal';
import type { HubNotification } from '../hooks/useHubNotifications';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "há 3 dias", "hoje", "amanhã", "em 2 dias" em relação a hoje. */
function whenLabel(iso: string, today: string): string {
  const days = Math.round((Date.parse(iso) - Date.parse(today)) / 86400000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  if (days === -1) return 'ontem';
  return days < 0 ? `há ${-days} dias` : `em ${days} dias`;
}

interface NotificationDetailsModalProps {
  notification: HubNotification | null;
  onClose: () => void;
  /** Leva ao Início (fecha este pop-up e a Central). */
  onOpenAction?: () => void;
}

/** Detalha os lançamentos que um aviso da Central sinaliza: o que é, de onde vem, quando e quanto. */
export const NotificationDetailsModal: React.FC<NotificationDetailsModalProps> = ({ notification, onClose, onOpenAction }) => {
  if (!notification) return null;
  const details = notification.details || [];
  const total = details.reduce((acc, d) => acc + d.amount, 0);
  const today = isoOf(new Date());

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={notification.title}
      subtitle={`${details.length} ${details.length === 1 ? 'lançamento' : 'lançamentos'} · ${brl(total)}`}
      maxWidth="520px"
    >
      <ul className="notif-details-list">
        {details.map((d) => (
          <li key={d.id} className={`notif-details-row ${d.overdue ? 'is-overdue' : ''}`}>
            <div className="notif-details-main">
              <strong className="notif-details-title">{d.title}</strong>
              {d.detail && <span className="notif-details-sub">{d.detail}</span>}
              <span className="notif-details-when">
                {ddmm(d.date)} · {whenLabel(d.date, today)}
              </span>
            </div>
            <strong className="notif-details-amount">{brl(d.amount)}</strong>
          </li>
        ))}
      </ul>
      <div className="notif-details-footer">
        <span>
          Total <strong>{brl(total)}</strong>
        </span>
        {onOpenAction && notification.actionLabel && (
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenAction}>
            <span>{notification.actionLabel}</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </Modal>
  );
};
