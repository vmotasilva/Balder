import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseConfirmDialogReturn {
  dialogProps: ConfirmDialogProps;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'warning';
    onConfirm: () => void;
  }) => void;
}

export function useConfirmDialog(): UseConfirmDialogReturn {
  const [state, setState] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Excluir',
    variant: 'danger',
    onConfirm: () => {},
  });

  const confirm = (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'warning';
    onConfirm: () => void;
  }) => {
    setState({
      isOpen: true,
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'Excluir',
      variant: opts.variant ?? 'danger',
      onConfirm: opts.onConfirm,
    });
  };

  const handleCancel = () => setState((prev) => ({ ...prev, isOpen: false }));
  const handleConfirm = () => {
    state.onConfirm();
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  return {
    confirm,
    dialogProps: {
      isOpen: state.isOpen,
      title: state.title,
      message: state.message,
      confirmLabel: state.confirmLabel,
      cancelLabel: 'Cancelar',
      variant: state.variant,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button by default (safer), close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const accentColor = isDanger ? '#EF4444' : '#F59E0B';
  const accentBg = isDanger ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)';
  const accentBorder = isDanger ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)';
  const confirmBtnBg = isDanger
    ? 'linear-gradient(135deg, #DC2626, #B91C1C)'
    : 'linear-gradient(135deg, #D97706, #B45309)';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'var(--bg-card, #111827)',
          border: `1px solid ${accentBorder}`,
          borderRadius: '16px',
          padding: '24px',
          boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${accentBorder}`,
          animation: 'slideUpFade 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div
            style={{
              flexShrink: 0,
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: accentBg,
              border: `1px solid ${accentBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accentColor,
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              id="confirm-dialog-title"
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary, #F8FAFC)',
                lineHeight: 1.3,
              }}
            >
              {title}
            </h3>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: '13px',
                color: 'var(--text-secondary, #94A3B8)',
                lineHeight: 1.5,
              }}
            >
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flexShrink: 0,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #64748B)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '6px',
              transition: 'color 0.15s',
            }}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-secondary, #94A3B8)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)';
              (e.currentTarget as HTMLButtonElement).style.color = '#F8FAFC';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary, #94A3B8)';
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: 'none',
              background: confirmBtnBg,
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: `0 4px 14px ${accentBg}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.15)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.filter = '';
              (e.currentTarget as HTMLButtonElement).style.transform = '';
            }}
          >
            <AlertTriangle size={14} />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
