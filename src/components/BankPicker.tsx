import React, { useMemo } from 'react';
import { ChevronRight, Layers } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { getBankBranding } from '../utils/bankBranding';
import { canonicalBankName, listPaymentInstitutions } from '../utils/paymentInstitutions';
import { BankInvoiceTerms } from './BankInvoiceTerms';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

interface Props {
  /** Banco escolhido para ver as faturas; 'ALL' mostra as faturas de todos. */
  onSelect: (bank: string) => void;
}

/** Faturas por banco: datas de fechamento e vencimento do banco e acesso às faturas dele. */
export const BankPicker: React.FC<Props> = ({ onSelect }) => {
  const { accounts, cards, banks, movements, consolidateCardNamedInvoices } = useFinancial();

  const groups = useMemo(() => {
    const names: string[] = [];
    const add = (n?: string) => {
      if (n && n.trim() && !names.some((x) => x.toLowerCase() === n.trim().toLowerCase())) names.push(n.trim());
    };
    listPaymentInstitutions(accounts, cards, banks).forEach((i) => add(i.name));
    const invoices = movements.filter((m) => m.type === 'CARTAO');
    invoices.forEach((m) => add(canonicalBankName(m.bank, banks, cards)));
    return names.map((name) => {
      const mine = invoices.filter((m) => canonicalBankName(m.bank, banks, cards).toLowerCase() === name.toLowerCase());
      const open = mine.filter((m) => m.status === 'PREVISTA').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return { name, count: mine.length, open: open.length, openTotal: open.reduce((s, m) => s + m.amount, 0), nextDue: open[0]?.dueDate };
    });
  }, [accounts, cards, banks, movements]);

  const strays = useMemo(
    () => movements.filter((m) => m.type === 'CARTAO' && !!m.bank && canonicalBankName(m.bank, banks, cards) !== m.bank).length,
    [movements, banks, cards]
  );

  return (
    <div className="bank-picker">
      <div className="bank-picker-head">
        <div>
          <h2>Escolha o banco</h2>
          <p>A fatura é do banco: fechamento e vencimento valem para todas as compras no crédito dele.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => onSelect('ALL')}>
          <Layers size={15} />
          <span>Ver faturas de todos os bancos</span>
        </button>
      </div>

      {strays > 0 && (
        <div className="bank-picker-notice">
          <span>
            {strays} {strays === 1 ? 'fatura está gravada' : 'faturas estão gravadas'} com o nome do cartão em vez do banco.
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => consolidateCardNamedInvoices()}>
            Passar para o banco e unir as do mesmo mês
          </button>
        </div>
      )}

      {groups.length === 0 && <p className="bank-picker-empty">Nenhum banco cadastrado ainda. Cadastre em Perfil ou peça para a Forseti.</p>}
      <div className="bank-picker-grid">
        {groups.map((g) => {
          const brand = getBankBranding(g.name);
          return (
            <div key={g.name} className="bank-picker-card" style={{ borderColor: brand.badgeBorder }}>
              <div className="bank-picker-card-head">
                <span className="bank-picker-icon" style={{ background: brand.badgeBg, color: brand.textColor }}>{brand.iconText}</span>
                <div>
                  <strong>{g.name}</strong>
                  <small>
                    {g.count === 0
                      ? 'Sem faturas'
                      : `${g.open} ${g.open === 1 ? 'fatura em aberto' : 'faturas em aberto'}${g.open > 0 ? ` · ${brl(g.openTotal)}` : ''}${g.nextDue ? ` · próxima ${ddmm(g.nextDue)}` : ''}`}
                  </small>
                </div>
              </div>
              <BankInvoiceTerms bank={g.name} />
              <button type="button" className="bank-picker-open" onClick={() => onSelect(g.name)}>
                <span>Ver faturas</span>
                <ChevronRight size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
