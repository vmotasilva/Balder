import React, { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { DateInput } from './DateInput';
import { useFinancial } from '../context/FinancialContext';
import { addCardPurchaseToInvoices, todayIso } from '../utils/cardPurchase';
import { userNatures } from '../utils/baseNatures';
import { parseMoney } from '../utils/parseDecimal';

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

interface AddInvoiceItemModalProps {
  /** Fatura que recebe o novo item; null fecha o pop-up. */
  invoiceId: string | null;
  onClose: () => void;
}

/** Novo registro direto na fatura aberta: um item à vista, que entra no total dela. */
export const AddInvoiceItemModal: React.FC<AddInvoiceItemModalProps> = ({ invoiceId, onClose }) => {
  const { movements } = useFinancial();
  const invoice = invoiceId ? movements.find((m) => m.id === invoiceId) : undefined;
  if (!invoice) return null;
  return <AddInvoiceItemForm key={invoice.id} invoiceId={invoice.id} onClose={onClose} />;
};

const AddInvoiceItemForm: React.FC<{ invoiceId: string; onClose: () => void }> = ({ invoiceId, onClose }) => {
  const { movements, natures, addMovement, updateMovement } = useFinancial();
  const invoice = movements.find((m) => m.id === invoiceId)!;
  const [description, setDescription] = useState('');
  const [natureId, setNatureId] = useState('');
  const [mappingItem, setMappingItem] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [amount, setAmount] = useState('');

  const mappings = useMemo(
    () => (natureId && natureId !== 'OUTROS' ? natures.find((n) => n.id === natureId)?.mappings || [] : []),
    [natureId, natures]
  );
  const value = parseMoney(amount);
  const valid = description.trim().length > 0 && value > 0;

  const save = () => {
    if (!valid) return;
    const nat = natures.find((n) => n.id === natureId);
    const real = natureId && natureId !== 'OUTROS' ? natureId : undefined;
    const [mappingId, mappingItemId] = real && mappingItem ? mappingItem.split(':::') : [undefined, undefined];
    addCardPurchaseToInvoices(
      {
        institution: invoice.bank || invoice.title,
        title: description.trim(),
        total: value,
        natureId: real,
        natureName: natureId === 'OUTROS' ? 'Outros' : nat?.name,
        mappingId,
        mappingItemId,
        purchaseDate: purchaseDate || todayIso(),
      },
      [{ dueDate: invoice.dueDate, amount: value }],
      movements,
      { addMovement, updateMovement }
    );
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title="Novo registro na fatura" subtitle={`${invoice.bank || invoice.title} · vence ${ddmm(invoice.dueDate)}`} maxWidth="520px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="invoice-add-desc">Descrição</label>
          <input id="invoice-add-desc" className="form-input" autoFocus value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="invoice-add-amount">Valor (R$)</label>
          <input id="invoice-add-amount" className="form-input" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="invoice-add-nature">Natureza</label>
          <select
            id="invoice-add-nature"
            className="form-input"
            value={natureId}
            onChange={(e) => {
              setNatureId(e.target.value);
              setMappingItem('');
            }}
          >
            <option value="">Sem natureza</option>
            {userNatures(natures).map((n) => (
              <option key={n.id} value={n.id}>
                {n.icon || '🏷️'} {n.name}
              </option>
            ))}
            <option value="OUTROS">📦 Outros</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="invoice-add-mapping">Mapeamento / item</label>
          <select id="invoice-add-mapping" className="form-input" value={mappingItem} onChange={(e) => setMappingItem(e.target.value)} disabled={mappings.length === 0}>
            <option value="">{mappings.length > 0 ? 'Nenhum (opcional)' : 'Sem mapeamento'}</option>
            {mappings.map((mp) => (
              <optgroup key={mp.id} label={mp.name}>
                {mp.items.map((mi) => (
                  <option key={mi.id} value={`${mp.id}:::${mi.id}`}>
                    {mi.description}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="invoice-add-date">Data da compra</label>
          <DateInput id="invoice-add-date" className="form-input" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          <span className="text-xs text-muted">Entra à vista nesta fatura e soma ao total dela.</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!valid}>
            Adicionar
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
};
