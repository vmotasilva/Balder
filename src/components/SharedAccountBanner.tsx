import React from 'react';
import { ArrowLeftCircle, Eye, HandCoins, Info, X } from 'lucide-react';
import { useAccountScope } from '../context/AccountScopeContext';
import { ROLE_LABEL, SCOPE_LABEL } from '../services/sharingService';

/** Faixa no topo quando uma conta compartilhada está aberta, e avisos (ex.: acesso encerrado). */
export const SharedAccountBanner: React.FC = () => {
  const { viewing, backToOwnAccount, notice, clearNotice } = useAccountScope();

  return (
    <>
      {notice && (
        <div className="shared-account-notice" role="status">
          <Info size={15} />
          <span>{notice}</span>
          <button type="button" onClick={clearNotice} aria-label="Fechar aviso">
            <X size={14} />
          </button>
        </div>
      )}
      {viewing && (
        <div className={`shared-account-banner ${viewing.role === 'COLABORADOR' ? 'is-collaborator' : ''}`}>
          {viewing.role === 'COLABORADOR' ? <HandCoins size={16} /> : <Eye size={16} />}
          <span>
            Você está na conta de <strong>{viewing.ownerName}</strong> · {ROLE_LABEL[viewing.role]} ·{' '}
            {SCOPE_LABEL[viewing.scope]}
          </span>
          <button type="button" className="btn btn-outline btn-xs" onClick={() => backToOwnAccount()}>
            <ArrowLeftCircle size={13} />
            <span>Voltar para minha conta</span>
          </button>
        </div>
      )}
    </>
  );
};
