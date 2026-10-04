import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, FileText, Handshake, Home, Landmark, TrendingUp } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { groupLoanMovements } from '../utils/loanMath';
import { LoansPage } from './LoansPage';
import { FinancingsPage } from './FinancingsPage';
import { InfoButton } from '../components/InfoButton';
import { InvestmentsPage } from './InvestmentsPage';

type ContractKind = 'EMPRESTIMOS' | 'INVESTIMENTOS' | 'FINANCIAMENTOS';

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
export const ContractsPage: React.FC<{ newLoanSignal?: number }> = ({ newLoanSignal = 0 }) => {
  const { movements, archivedLoanGroups } = useFinancial();
  const [openKind, setOpenKind] = useState<ContractKind | null>(newLoanSignal > 0 ? 'EMPRESTIMOS' : null);
  // O simulador só abre sozinho quando veio do "+"; voltar ou entrar de novo pelos cartões não o reabre
  const [autoOpenSim, setAutoOpenSim] = useState(newLoanSignal > 0);
  useEffect(() => {
    if (newLoanSignal > 0) {
      setOpenKind('EMPRESTIMOS');
      setAutoOpenSim(true);
    }
  }, [newLoanSignal]);

  const loanSummary = useMemo(() => {
    const active = groupLoanMovements(movements).filter((g) => !archivedLoanGroups.includes(g.groupId));
    return { count: active.length, balance: active.reduce((sum, g) => sum + g.nominalBalance, 0) };
  }, [movements, archivedLoanGroups]);

  if (openKind === 'EMPRESTIMOS') {
    return (
      <>
        <div className="page-container" style={{ paddingBottom: 0 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => {
              setOpenKind(null);
              setAutoOpenSim(false);
            }}>
            <ArrowLeft size={14} />
            <span>Contratos</span>
          </button>
        </div>
        <LoansPage openSimulatorSignal={autoOpenSim ? newLoanSignal : 0} />
      </>
    );
  }

  if (openKind === 'INVESTIMENTOS') {
    return (
      <>
        <div className="page-container" style={{ paddingBottom: 0 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpenKind(null)}>
            <ArrowLeft size={14} />
            <span>Contratos</span>
          </button>
        </div>
        <InvestmentsPage />
      </>
    );
  }

  if (openKind === 'FINANCIAMENTOS') {
    return (
      <>
        <div className="page-container" style={{ paddingBottom: 0 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpenKind(null)}>
            <ArrowLeft size={14} />
            <span>Contratos</span>
          </button>
        </div>
        <FinancingsPage />
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
    { id: 'FINANCIAMENTOS', label: 'Financiamentos', icon: Home, kind: 'FINANCIAMENTOS', status: 'Simule SAC e Price' },
    { id: 'CONSORCIOS', label: 'Consórcios', icon: Handshake, status: 'Em breve' },
    { id: 'INVESTIMENTOS', label: 'Investimentos', icon: TrendingUp, kind: 'INVESTIMENTOS', status: 'Abrir carteira' },
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
            onClick={() => {
              setAutoOpenSim(false);
              if (m.kind) setOpenKind(m.kind);
            }}
          >
            <m.icon size={18} aria-hidden="true" />
            <span className="home-module-label">{m.label}</span>
            <span className={`home-module-status ${(m.kind === 'FINANCIAMENTOS' || (m.kind === 'EMPRESTIMOS' && loanSummary.count === 0)) ? 'is-invite' : ''}`}>{m.status}</span>
            {m.kind && <ChevronRight size={14} className="home-module-arrow" aria-hidden="true" />}
          </button>
        ))}
      </section>
    </div>
  );
};
