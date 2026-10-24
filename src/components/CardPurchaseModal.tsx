import React, { useMemo, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Modal } from './Modal';
import { DateInput } from './DateInput';
import { useFinancial } from '../context/FinancialContext';
import {
  canRefundIof,
  findPurchaseParts,
  firstInvoiceDueDate,
  iofRefundUpdates,
  invoiceItemEditUpdates,
  purchaseRebuildBlock,
  rebuildCardPurchase,
  todayIso,
  type PurchaseDestination,
} from '../utils/cardPurchase';
import { userNatures } from '../utils/baseNatures';
import { parseMoney } from '../utils/parseDecimal';
import { canonicalBankName, listPaymentInstitutions } from '../utils/paymentInstitutions';
import { INSTALLMENT_CHOICES } from '../utils/paymentHow';
import { installmentSchedule } from '../utils/forsetiAssistant';
import { CASH_IN_HAND } from '../utils/cashInHand';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const toInput = (v: number) => v.toFixed(2).replace('.', ',');

type How = 'CASH' | 'DEBITO' | 'CREDITO';

interface CardPurchaseModalProps {
  /** Fatura que contém a compra e id do item dela; null fecha o pop-up. */
  target: { invoiceId: string; itemId: string } | null;
  onClose: () => void;
}

/**
 * Pop-up padrão de uma compra no cartão: mostra a compra (fatura, parcela, valor final, peso na fatura) e permite
 * corrigir nome, natureza/mapeamento, data da compra, valores e o IOF estornado. Também refaz a forma de pagamento
 * (dinheiro, débito/Pix ou crédito, banco, à vista ou parcelado): a compra sai das faturas onde está e entra no novo destino.
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
  const { movements, natures, updateMovement, addMovement, deleteMovement, markMappingItemsFulfilled, accounts, cards, banks } = useFinancial();
  const invoice = movements.find((m) => m.id === invoiceId)!;
  const item = invoice.invoiceBreakdown!.find((i) => i.id === itemId)!;
  const inst = item.installments || 1;
  const hasInstallments = inst > 1;
  const finalValue = item.finalAmount ?? item.amount * inst;

  const institutions = useMemo(() => listPaymentInstitutions(accounts, cards, banks), [accounts, cards, banks]);
  const originalBank = canonicalBankName(invoice.bank || invoice.title, banks, cards);
  const parts = useMemo(() => findPurchaseParts(movements, invoiceId, itemId), [movements, invoiceId, itemId]);
  const block = purchaseRebuildBlock(parts);

  const [description, setDescription] = useState(item.description.replace(/\s*\(\d+\/\d+\)$/, ''));
  const [natureId, setNatureId] = useState(item.natureId || (item.natureName === 'Outros' ? 'OUTROS' : ''));
  const [mappingItem, setMappingItem] = useState(item.mappingId && item.mappingItemId ? `${item.mappingId}:::${item.mappingItemId}` : '');
  const [purchaseDate, setPurchaseDate] = useState(item.purchaseDate || '');
  const [amount, setAmount] = useState(toInput(item.amount));
  const [finalAmount, setFinalAmount] = useState(toInput(finalValue));
  const [iof, setIof] = useState(item.iofRefund ? toInput(item.iofRefund) : '');
  // Forma de pagamento: começa como está (crédito no banco da fatura, nas parcelas atuais)
  const [how, setHow] = useState<How>('CREDITO');
  const [institution, setInstitution] = useState(originalBank);
  const [installments, setInstallments] = useState(inst);
  const [totalValue, setTotalValue] = useState(toInput(finalValue));

  const mappings = useMemo(
    () => (natureId && natureId !== 'OUTROS' ? natures.find((n) => n.id === natureId)?.mappings || [] : []),
    [natureId, natures]
  );

  const creditOrDebit = how === 'CREDITO' ? institutions.filter((i) => !i.noCredit) : institutions;
  const bankChoices =
    !originalBank || creditOrDebit.some((i) => i.name.toLowerCase() === originalBank.toLowerCase())
      ? creditOrDebit
      : [...creditOrDebit, { name: originalBank } as (typeof institutions)[number]];
  const chosenBank = bankChoices.some((b) => b.name === institution) ? institution : bankChoices[0]?.name || '';
  const installmentChoices = [...new Set([...INSTALLMENT_CHOICES, inst])].sort((a, b) => a - b);

  // Mudou a forma de pagamento: a compra é refeita (todas as parcelas) em vez de só editada
  const rebuild = !block && (how !== 'CREDITO' || chosenBank.toLowerCase() !== originalBank.toLowerCase() || installments !== inst);
  const total = parseMoney(rebuild ? totalValue : amount);
  const amountValue = parseMoney(amount);
  const today = todayIso();
  const paidNow = rebuild && how !== 'CREDITO';
  const futurePaid = paidNow && (!purchaseDate || purchaseDate > today);
  const terms = how === 'CREDITO' ? institutions.find((i) => i.name === chosenBank)?.terms : undefined;
  const firstDue = firstInvoiceDueDate(purchaseDate || today, terms?.closingDay, terms?.dueDay);
  const schedule =
    !rebuild || how !== 'CREDITO' || total <= 0
      ? []
      : installments > 1
      ? installmentSchedule(total, installments, firstDue, terms?.dueDay)
      : [{ dueDate: firstDue, amount: total }];
  const needsBank = how !== 'CASH';
  const valid = description.trim().length > 0 && total > 0 && !futurePaid && (!rebuild || !needsBank || !!chosenBank);
  const share = invoice.amount > 0 ? (item.amount / invoice.amount) * 100 : 0;

  const save = () => {
    if (!valid) return;
    const nat = natures.find((n) => n.id === natureId);
    const [mappingId, mappingItemId] = mappingItem ? mappingItem.split(':::') : [undefined, undefined];

    if (rebuild) {
      const real = natureId && natureId !== 'OUTROS' ? natureId : undefined;
      const dest: PurchaseDestination =
        how === 'CREDITO'
          ? {
              kind: 'CARD',
              institution: chosenBank,
              parts: schedule,
              sameInstitution: (bank) => canonicalBankName(bank, banks, cards).toLowerCase() === chosenBank.toLowerCase(),
            }
          : { kind: 'PAID', bank: how === 'CASH' ? CASH_IN_HAND : institutions.find((i) => i.name === chosenBank)?.account?.name ?? chosenBank };
      const result = rebuildCardPurchase(
        movements,
        parts,
        {
          title: description.trim(),
          natureId: real,
          natureName: natureId === 'OUTROS' ? 'Outros' : nat?.name,
          mappingId: real ? mappingId : undefined,
          mappingItemId: real ? mappingItemId : undefined,
          purchaseDate: purchaseDate || today,
          total,
        },
        dest
      );
      result.updates.forEach((u) => updateMovement(u.id, u.updates));
      result.deletes.forEach((id) => deleteMovement(id));
      result.adds.forEach((m) => addMovement(m));
      if (result.fulfill) markMappingItemsFulfilled([result.fulfill]);
      onClose();
      return;
    }

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

        <div className="form-group">
          <label className="form-label" htmlFor="card-purchase-date">Data da compra</label>
          <DateInput id="card-purchase-date" className="form-input" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </div>

        <div className="form-group">
          <span className="form-label">Forma de pagamento</span>
          {block ? (
            <span className="text-xs text-muted">{block}</span>
          ) : (
            <>
              <div className="realization-chips">
                {([['CASH', '💵 Dinheiro em mãos'], ['DEBITO', '🏦 Débito / Pix'], ['CREDITO', '💳 Crédito']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`realization-chip ${how === key ? 'is-active' : ''}`}
                    onClick={() => {
                      setHow(key);
                      setInstallments(key === 'CREDITO' ? inst : 1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {needsBank && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <select className="form-input" style={{ flex: 1, minWidth: '140px' }} value={chosenBank} onChange={(e) => setInstitution(e.target.value)} aria-label="Banco">
                    {bankChoices.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {how === 'CREDITO' && (
                    <select className="form-input" style={{ width: '120px' }} value={installments} onChange={(e) => setInstallments(Number(e.target.value))} aria-label="Parcelas">
                      {installmentChoices.map((n) => (
                        <option key={n} value={n}>
                          {n === 1 ? 'À vista' : `${n}x`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {rebuild && how === 'CREDITO' && schedule.length > 0 && (
                <span className="text-xs text-muted">
                  {schedule.length === 1 ? `À vista de ${formatBRL(schedule[0].amount)}` : `${schedule.length}x de ${formatBRL(schedule[0].amount)}`} · 1ª fatura de {chosenBank} vence{' '}
                  {ddmm(schedule[0].dueDate)}.
                </span>
              )}
              {paidNow && (
                <span className="text-xs text-muted">Sai do saldo na data da compra e deixa de estar na fatura.</span>
              )}
              {rebuild && (parts.length > 1 || item.iofRefund) ? (
                <span className="text-xs text-muted">
                  {parts.length > 1 ? `Refaz as ${parts.length} parcelas desta compra. ` : ''}
                  {item.iofRefund ? 'O abate de IOF é desfeito; aplique de novo depois, se precisar.' : ''}
                </span>
              ) : null}
              {futurePaid && <span className="text-xs text-rose">Para pagar no débito ou em dinheiro, informe a data da compra (não pode ser depois de hoje).</span>}
            </>
          )}
        </div>

        {rebuild ? (
          <div className="form-group">
            <label className="form-label" htmlFor="card-purchase-total">Valor total da compra (R$)</label>
            <input id="card-purchase-total" className="form-input" inputMode="decimal" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} />
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="card-purchase-amount">Valor nesta fatura (R$)</label>
              <input id="card-purchase-amount" className="form-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            {hasInstallments && (
              <div className="form-group">
                <label className="form-label" htmlFor="card-purchase-final">Valor final da compra (R$)</label>
                <input id="card-purchase-final" className="form-input" inputMode="decimal" value={finalAmount} onChange={(e) => setFinalAmount(e.target.value)} />
                <span className="text-xs text-muted">
                  Parcela {item.currentInstallment || 1} de {inst}: valor e data mudam só nesta parcela; para mudar o parcelamento, use a forma de pagamento.
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
          </>
        )}

        {invoice.status === 'REALIZADA' && (
          <span className="text-xs text-muted">Fatura já paga: o total dela não muda; a diferença fica em "Não Analisada".</span>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!valid}>
            {rebuild ? 'Refazer compra' : 'Salvar'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
};
