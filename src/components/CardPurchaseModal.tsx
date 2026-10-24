import React, { useMemo, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Modal } from './Modal';
import { DateInput } from './DateInput';
import { useFinancial } from '../context/FinancialContext';
import { canRefundIof, iofRefundUpdates, invoiceItemEditUpdates } from '../utils/cardPurchase';
import { userNatures } from '../utils/baseNatures';
import { parseMoney } from '../utils/parseDecimal';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const toInput = (v: number) => v.toFixed(2).replace('.', ',');

interface CardPurchaseModalProps {
  /** Fatura que contém a compra e id do item dela; null fecha o pop-up. */
  target: { invoiceId: string; itemId: string } | null;
  onClose: () => void;
}

/**
 * Pop-up padrão de uma compra no cartão: mostra a compra (fatura, parcela, valor final, peso na fatura) e permite
 * corrigir nome, natureza/mapeamento, data da compra, valores e o IOF estornado. Só mexe no item desta fatura;
 * as outras parcelas de uma compra parcelada ficam nas faturas seguintes.
 */
export const CardPurchaseModal: React.FC<CardPurchaseModalProps> = ({ target, onClose }) => {
  const { movements } = useFinancial();
  const invoice = target ? movements.find((m) => m.id === target.invoiceId) : undefined;
  const item = invoice?.invoiceBreakdown?.find((i) => i.id === target?.itemId);
  if (!target || !invoice || !item) return null;
  // key: o formulário recomeça a cada compra aberta
  return <CardPurchaseForm key={`${invoice.id}:${item.id}`} invoiceId={invoice.id} itemId={item.id} onClose={onClose} />;
};

interface FormProps {
  invoiceId: string;
  itemId: string;
  onClose: () => void;
}

const CardPurchaseForm: React.FC<FormProps> = ({ invoiceId, itemId, onClose }) => {
  const { movements, natures, updateMovement } = useFinancial();
  const invoice = movements.find((m) => m.id === invoiceId)!;
  const item = invoice.invoiceBreakdown!.find((i) => i.id === itemId)!;
  const inst = item.installments || 1;
  const hasInstallments = inst > 1;
  const finalValue = item.finalAmount ?? item.amount * inst;

  const [description, setDescription] = useState(item.description.replace(/\s*\(\d+\/\d+\)$/, ''));
  const [natureId, setNatureId] = useState(item.natureId || (item.natureName === 'Outros' ? 'OUTROS' : ''));
  const [mappingItem, setMappingItem] = useState(item.mappingId && item.mappingItemId ? `${item.mappingId}:::${item.mappingItemId}` : '');
  const [purchaseDate, setPurchaseDate] = useState(item.purchaseDate || '');
  const [amount, setAmount] = useState(toInput(item.amount));
  const [finalAmount, setFinalAmount] = useState(toInput(finalValue));
  const [iof, setIof] = useState(item.iofRefund ? toInput(item.iofRefund) : '');

  const mappings = useMemo(
    () => (natureId && natureId !== 'OUTROS' ? natures.find((n) => n.id === natureId)?.mappings || [] : []),
    [natureId, natures]
  );
  const amountValue = parseMoney(amount);
  const valid = description.trim().length > 0 && amountValue > 0;
  const share = invoice.amount > 0 ? (item.amount / invoice.amount) * 100 : 0;

  const save = () => {
    if (!valid) return;
    const nat = natures.find((n) => n.id === natureId);
    const [mappingId, mappingItemId] = mappingItem ? mappingItem.split(':::') : [undefined, undefined];
    const edit = invoiceItemEditUpdates(invoice, item.id, {
      description,
      natureId,
      natureName: nat?.name || '',
      mappingId,
      mappingItemId,
      purchaseDate: purchaseDate || undefined,
      amount: amountValue,
      finalAmount: hasInstallments ? parseMoney(finalAmount) || undefined : undefined,
    });
    if (!edit) return;
    let updates: Partial<typeof invoice> = edit;
    // O abate de IOF parte da fatura já com a edição aplicada
    const wantedIof = canRefundIof(item) ? parseMoney(iof) || 0 : item.iofRefund || 0;
    if (wantedIof !== (item.iofRefund || 0)) {
      const withIof = iofRefundUpdates({ ...invoice, ...edit }, item.id, wantedIof);
      if (withIof) updates = { ...edit, ...withIof };
    }
    updateMovement(invoice.id, updates);
    onClose();
  };

  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '6px 0' };

  return (
    <Modal isOpen onClose={onClose} title="Compra no cartão" subtitle={`${invoice.bank || invoice.title} · fatura vence ${ddmm(invoice.dueDate)}`} maxWidth="520px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-default)', background: 'var(--bg-card)' }}>
          <div style={{ ...row, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, overflowWrap: 'anywhere' }}>
              <CreditCard size={14} /> {item.description}
            </span>
            <strong style={{ whiteSpace: 'nowrap' }}>{formatBRL(item.amount)}</strong>
          </div>
          <div className="text-xs text-muted">
            {item.natureName}
            {hasInstallments ? ` · parcela ${item.currentInstallment || 1}/${inst}` : ' · à vista'}
            {item.purchaseDate ? ` · compra ${ddmm(item.purchaseDate)}` : ''}
          </div>
          <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
            {hasInstallments ? `Valor final ${formatBRL(finalValue)} · ` : ''}
            {share.toFixed(1)}% da fatura de {formatBRL(invoice.amount)}
            {item.iofRefund ? ` · IOF estornado −${formatBRL(item.iofRefund)}` : ''}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="card-purchase-desc">Descrição</label>
          <input id="card-purchase-desc" className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="card-purchase-nature">Natureza</label>
          <select
            id="card-purchase-nature"
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
          <label className="form-label" htmlFor="card-purchase-mapping">Mapeamento / item</label>
          <select id="card-purchase-mapping" className="form-input" value={mappingItem} onChange={(e) => setMappingItem(e.target.value)} disabled={mappings.length === 0}>
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

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '1 1 140px' }}>
            <label className="form-label" htmlFor="card-purchase-date">Data da compra</label>
            <DateInput id="card-purchase-date" className="form-input" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: '1 1 140px' }}>
            <label className="form-label" htmlFor="card-purchase-amount">Valor nesta fatura (R$)</label>
            <input id="card-purchase-amount" className="form-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>

        {hasInstallments && (
          <div className="form-group">
            <label className="form-label" htmlFor="card-purchase-final">Valor final da compra (R$)</label>
            <input id="card-purchase-final" className="form-input" inputMode="decimal" value={finalAmount} onChange={(e) => setFinalAmount(e.target.value)} />
            <span className="text-xs text-muted">
              Parcela {item.currentInstallment || 1} de {inst}: as outras parcelas ficam nas próximas faturas e não mudam por aqui.
            </span>
          </div>
        )}

        {canRefundIof(item) && (
          <div className="form-group">
            <label className="form-label" htmlFor="card-purchase-iof">IOF estornado (R$)</label>
            <input id="card-purchase-iof" className="form-input" inputMode="decimal" placeholder="0,00" value={iof} onChange={(e) => setIof(e.target.value)} />
            <span className="text-xs text-muted">O valor abatido sai do item e do total da fatura. 0 desfaz o abate.</span>
          </div>
        )}

        {invoice.status === 'REALIZADA' && (
          <span className="text-xs text-muted">Fatura já paga: o total dela não muda; a diferença fica em "Não Analisada".</span>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!valid}>
            Salvar
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
};
