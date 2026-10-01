import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, FileText, Handshake, Home, Landmark } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { groupLoanMovements } from '../utils/loanMath';
import { LoansPage } from './LoansPage';
import { InfoButton } from '../components/InfoButton';

type ContractKind = 'EMPRESTIMOS';

interface ContractModality {
  id: string;
  label: string;
  icon: React.ElementType;
  /** Quando preenchido, a modalidade já está disponível e abre essa tela */
  kind?: ContractKind;
  status: string;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Hub de contratos de crédito: cada modalidade (empréstimos, financiamentos, consórcios…) abre na sua tela. */
export const ContractsPage: React.FC = () => {
  const { movements, archivedLoanGroups } = useFinancial();
  const [openKind, setOpenKind] = useState<ContractKind | null>(null);

  const loanSummary = useMemo(() => {
    const active = groupLoanMovements(movements).filter((g) => !archivedLoanGroups.includes(g.groupId));
    return { count: active.length, balance: active.reduce((sum, g) => sum + g.nominalBalance, 0) };
  }, [movements, archivedLoanGroups]);

  if (openKind === 'EMPRESTIMOS') {
    return (
      <>
        <div className="page-container" style={{ paddingBottom: 0 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpenKind(null)}>
            <ArrowLeft size={14} />
            <span>Contratos</span>
          </button>
        </div>
        <LoansPage />
      </>
    );
  }

  const modalities: ContractModality[] = [
    {
      id: 'EMPRESTIMOS',
      label: 'Empréstimos',
      icon: Landmark,
      kind: 'EMPRESTIMOS',
      status:
        loanSummary.count > 0
          ? `${loanSummary.count} ativo(s) · ${formatBRL(loanSummary.balance)}`
          : 'Simule ou cadastre',
    },
    { id: 'FINANCIAMENTOS', label: 'Financiamentos', icon: Home, status: 'Em breve' },
    { id: 'CONSORCIOS', label: 'Consórcios', icon: Handshake, status: 'Em breve' },
    { id: 'OUTROS', label: 'Outros contratos', icon: FileText, status: 'Em breve' },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <div className="kicker-badge">
            <FileText size={14} className="text-cyan" />
            <span>CRÉDITO & COMPROMISSOS</span>
          </div>
          <h1 className="page-title label-with-info">
            Contratos
            <InfoButton title="Contratos">
              <p>Reúne seus contratos de crédito por modalidade. Escolha uma para acompanhar parcelas, saldo devedor e simular antecipações.</p>
            </InfoButton>
          </h1>
        </div>
      </div>

      <section className="home-modules">
        {modalities.map((m) => (
          <button
            key={m.id}
            type="button"
            className="home-module"
            disabled={!m.kind}
            style={m.kind ? undefined : { opacity: 0.55, cursor: 'default' }}
            onClick={() => m.kind && setOpenKind(m.kind)}
          >
            <m.icon size={18} aria-hidden="true" />
            <span className="home-module-label">{m.label}</span>
            <span className={`home-module-status ${m.kind && loanSummary.count === 0 ? 'is-invite' : ''}`}>{m.status}</span>
            {m.kind && <ChevronRight size={14} className="home-module-arrow" aria-hidden="true" />}
          </button>
        ))}
      </section>
    </div>
  );
};
