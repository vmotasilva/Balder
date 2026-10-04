import React, { useEffect, useMemo, useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { canonicalBankName, listPaymentInstitutions } from '../utils/paymentInstitutions';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * Fechamento e vencimento da fatura de um banco: ficam no banco e valem para todas as compras no crédito dele.
 * Ao mudar o vencimento, oferece mover também as faturas em aberto.
 */
export const BankInvoiceTerms: React.FC<{ bank: string }> = ({ bank }) => {
  const { accounts, cards, banks, movements, setBankInvoiceTerms, applyBankDueDayToOpenInvoices } = useFinancial();
  const terms = useMemo(
    () => listPaymentInstitutions(accounts, cards, banks).find((i) => i.name.toLowerCase() === bank.toLowerCase())?.terms,
    [accounts, cards, banks, bank]
  );
  const [closing, setClosing] = useState<number | ''>(terms?.closingDay ?? '');
  const [due, setDue] = useState<number | ''>(terms?.dueDay ?? '');
  const [shiftOpen, setShiftOpen] = useState(true);
  const [done, setDone] = useState('');

  useEffect(() => {
    setClosing(terms?.closingDay ?? '');
    setDue(terms?.dueDay ?? '');
  }, [terms?.closingDay, terms?.dueDay, bank]);

  const dueChanged = due !== '' && due !== (terms?.dueDay ?? '');
  const openToMove = useMemo(
    () =>
      due === ''
        ? 0
        : movements.filter(
            (m) =>
              m.type === 'CARTAO' &&
              m.status === 'PREVISTA' &&
              canonicalBankName(m.bank, banks, cards).toLowerCase() === bank.toLowerCase() &&
              parseInt(m.dueDate.slice(8, 10), 10) !== due
          ).length,
    [movements, banks, cards, bank, due]
  );
  const dirty = closing !== (terms?.closingDay ?? '') || due !== (terms?.dueDay ?? '');

  const save = () => {
    if (closing === '' || due === '') return;
    setBankInvoiceTerms(bank, { closingDay: closing, dueDay: due });
    const moved = shiftOpen && dueChanged ? applyBankDueDayToOpenInvoices(bank, due) : 0;
    setDone(moved > 0 ? `Salvo. ${moved} ${moved === 1 ? 'fatura em aberto passou' : 'faturas em aberto passaram'} a vencer no dia ${due}.` : 'Salvo.');
  };

  return (
    <div className="bank-terms">
      <div className="bank-terms-row">
        <label>
          <span>Fecha dia</span>
          <select className="form-select" value={closing} onChange={(e) => { setDone(''); setClosing(e.target.value ? parseInt(e.target.value, 10) : ''); }}>
            <option value="">—</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Vence dia</span>
          <select className="form-select" value={due} onChange={(e) => { setDone(''); setDue(e.target.value ? parseInt(e.target.value, 10) : ''); }}>
            <option value="">—</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || closing === '' || due === ''} onClick={save}>
          Salvar
        </button>
      </div>
      {dueChanged && openToMove > 0 && (
        <label className="bank-terms-check">
          <input type="checkbox" checked={shiftOpen} onChange={(e) => setShiftOpen(e.target.checked)} />
          <span>
            Mover também o vencimento das {openToMove} {openToMove === 1 ? 'fatura em aberto' : 'faturas em aberto'} para o dia {due}
          </span>
        </label>
      )}
      {!terms && !done && <span className="bank-terms-hint">Informe o fechamento e o vencimento: eles definem em qual fatura cada compra cai.</span>}
      {done && <span className="bank-terms-hint ok">{done}</span>}
    </div>
  );
};
