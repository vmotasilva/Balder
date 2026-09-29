import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';

interface InfoButtonProps {
  /** Título do pop-up (também usado no rótulo acessível do botão). */
  title: string;
  children: React.ReactNode;
}

/**
 * Ícone "i" que abre um pop-up com a explicação. Tira os textos didáticos do meio dos formulários,
 * deixando à vista só o que a pessoa precisa preencher.
 */
export const InfoButton: React.FC<InfoButtonProps> = ({ title, children }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Fecha só o pop-up, não o modal que está por baixo
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="info-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Saiba mais: ${title}`}
        title="Saiba mais"
      >
        <Info size={14} />
      </button>
      {open &&
        createPortal(
          <div className="info-pop-backdrop" onClick={() => setOpen(false)}>
            <div className="info-pop" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
              <div className="info-pop-head">
                <Info size={16} className="text-cyan" />
                <strong>{title}</strong>
                <button type="button" className="info-pop-close" onClick={() => setOpen(false)} aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>
              <div className="info-pop-body">{children}</div>
              <button type="button" className="btn btn-primary btn-sm info-pop-ok" onClick={() => setOpen(false)}>
                Entendi
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
