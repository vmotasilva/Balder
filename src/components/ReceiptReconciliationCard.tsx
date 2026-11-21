import React, { useState } from 'react';
import { DecimalInput } from './DecimalInput';
import { parseMoney } from '../utils/parseDecimal';
import type { ReceiptReconciliationData, ReceiptItemLine, ExpenseNature } from '../types';
import { useFinancial } from '../context/FinancialContext';
import { QuickCreateMappingItemModal } from './QuickCreateMappingItemModal';
import { MappingCombobox } from './MappingCombobox';
import type { ComboboxOption } from './MappingCombobox';
import { learnReceiptItemAssociation, autoAssociateReceiptTextToMappingKeywords } from '../services/receiptMemoryService';
import { Check, Plus, Edit2, AlertCircle, ShoppingBag, Sparkles, Store, Calendar, DollarSign, Wallet, CheckCircle2, CreditCard } from 'lucide-react';
import { DateInput } from './DateInput';

interface Props {
  data: ReceiptReconciliationData;
  messageId: string;
  natures: ExpenseNature[];
  onConfirm: (messageId: string, updatedData: ReceiptReconciliationData) => void;
}

export const ReceiptReconciliationCard: React.FC<Props> = ({
  data,
  messageId,
  natures,
  onConfirm,
}) => {
  const { addItemToMapping, updateMapping, addMappingToNature, movements, associateReceiptItemsToInvoice } = useFinancial();
  const [store, setStore] = useState(data.store);
  const [date, setDate] = useState(data.date);
  const [totalAmount, setTotalAmount] = useState(data.totalAmount);
  const [paymentMethod, setPaymentMethod] = useState(data.paymentMethod);
  const [items, setItems] = useState<ReceiptItemLine[]>(data.items);
  const [isEditingHeader, setIsEditingHeader] = useState(false);

  // Faturas de Cartão disponíveis para vínculo direto de itens não mapeados
  const cardInvoices = movements.filter((m) => m.type === 'CARTAO');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(() => {
    const openWithUnmapped = cardInvoices.find((m) => (m.unanalyzedAmount || 0) > 0.01);
    return openWithUnmapped?.id || cardInvoices[0]?.id || '';
  });

  // Modal para criar item de mapeamento na hora
  const [modalItem, setModalItem] = useState<ReceiptItemLine | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Opções = MAPEAMENTOS (o destino da associação). Os itens da memória de cálculo são só palavras-chave.
  const availableMappingOptions: { id: string; name: string; natureName: string; natureId: string; itemCount: number }[] = [];
  natures.forEach((nat) => {
    nat.mappings.forEach((map) => {
      availableMappingOptions.push({
        id: map.id,
        name: map.name,
        natureName: nat.name,
        natureId: nat.id,
        itemCount: (map.items || []).length,
      });
    });
  });

  // Opções formatadas para o combobox, agrupadas por natureza
  const buildComboboxOptions = (forItem: ReceiptItemLine): ComboboxOption[] => {
    const regular: ComboboxOption[] = availableMappingOptions.map((opt) => ({
      value: opt.id,
      label: opt.name,
      sublabel: opt.natureName,
      group: opt.natureName,
      isMatched: forItem.targetMappingId === opt.id,
    }));

    const specials: ComboboxOption[] = [
      {
        value: 'NEW_ITEM',
        label: 'Mapear como Novo Item',
        sublabel: 'Criar o item e vincular ao mapeamento',
        group: 'Ações Especiais',
        isSpecial: true,
      },
      {
        value: 'UNMAPPED_AVULSO',
        label: 'Despesa Avulsa',
        sublabel: 'Não vincular ao mapeamento fixo',
        group: 'Ações Especiais',
        isSpecial: true,
      },
    ];

    return [...regular, ...specials];
  };

  const handleOpenCreateModal = (item: ReceiptItemLine) => {
    setModalItem(item);
    setIsModalOpen(true);
  };

  const handleSaveAndAssociateNewItem = (
    receiptItemId: string,
    natureId: string,
    mappingId: string,
    itemData: {
      description: string;
      quantity: number;
      price: number;
      unit: string;
      multiplierWeeks: number;
    }
  ) => {
    const targetItem = items.find((it) => it.id === receiptItemId);
    const initialKeywords = Array.from(
      new Set(
        [
          itemData.description.toLowerCase().trim(),
          targetItem?.detectedName?.toLowerCase()?.trim(),
          targetItem?.rawName?.toLowerCase()?.trim(),
        ].filter((k): k is string => Boolean(k && k.length >= 2))
      )
    );

    // 1. Criar o item no mapeamento de gastos fixos da natureza no Balder
    const createdItemId = addItemToMapping(natureId, mappingId, {
      description: itemData.description,
      quantity: itemData.quantity,
      price: itemData.price,
      unit: itemData.unit,
      multiplierWeeks: itemData.multiplierWeeks,
      realizedValue: itemData.price,
      isFulfilled: true,
      keywords: initialKeywords,
    });

    // 2. Treinar Forseti imediatamente para este e futuros cupons
    if (targetItem) {
      learnReceiptItemAssociation(targetItem.detectedName, mappingId, natureId, createdItemId);
    }

    // 3. Atualizar a linha na tabela de conciliação imediatamente
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== receiptItemId) return it;
        return {
          ...it,
          matchedMappingItemId: createdItemId,
          aiSuggested: false,
          targetMappingId: mappingId,
          natureId: natureId,
          isNewSuggestedItem: false, // Agora já está formalmente mapeado!
        };
      })
    );

    setNotificationMsg(`Item "${itemData.description}" cadastrado na rotina e associado com sucesso!`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleItemMappingChange = (itemId: string, targetOptId: string) => {
    const targetIt = items.find((it) => it.id === itemId);

    if (targetOptId === 'NEW_ITEM') {
      if (targetIt) {
        handleOpenCreateModal(targetIt);
      }
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it;
          return {
            ...it,
            matchedMappingItemId: undefined,
            targetMappingId: undefined,
            isNewSuggestedItem: true,
            aiSuggested: false,
          };
        })
      );
      return;
    }

    if (targetOptId === 'UNMAPPED_AVULSO') {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it;
          return {
            ...it,
            matchedMappingItemId: undefined,
            targetMappingId: undefined,
            isNewSuggestedItem: false,
            aiSuggested: false,
          };
        })
      );
      return;
    }

    const foundOpt = availableMappingOptions.find((opt) => opt.id === targetOptId);
    if (targetIt && foundOpt) {
      autoAssociateReceiptTextToMappingKeywords(
        targetIt.rawName || targetIt.detectedName,
        foundOpt.natureId,
        foundOpt.id,
        updateMapping,
        natures
      );
    }

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          // Trocar o mapeamento invalida o item que servia de pista para o anterior
          matchedMappingItemId: it.targetMappingId === targetOptId ? it.matchedMappingItemId : undefined,
          targetMappingId: foundOpt?.id,
          natureId: foundOpt?.natureId || 'nat_alimentacao',
          isNewSuggestedItem: false,
          aiSuggested: false,
        };
      })
    );
  };

  const handleItemPriceChange = (itemId: string, newPrice: string | number) => {
    const parsed = typeof newPrice === 'number' ? newPrice : parseMoney(newPrice);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    setItems((prev) => {
      const updated = prev.map((it) => (it.id === itemId ? { ...it, price: parsed } : it));
      const newTotal = Math.round(updated.reduce((acc, curr) => acc + curr.price, 0) * 100) / 100;
      setTotalAmount(newTotal);
      return updated;
    });
  };

  const handleConfirm = () => {
    items.forEach((it) => {
      if (it.natureId && it.targetMappingId) {
        autoAssociateReceiptTextToMappingKeywords(
          it.rawName || it.detectedName,
          it.natureId,
          it.targetMappingId,
          updateMapping,
          natures,
          it.matchedMappingItemId
        );
      }
    });

    onConfirm(messageId, {
      ...data,
      store,
      date,
      totalAmount,
      paymentMethod,
      items,
      isReconciled: true,
    });
  };

  const handleLinkToInvoice = () => {
    if (!selectedInvoiceId) return;

    items.forEach((it) => {
      if (it.natureId && it.targetMappingId) {
        autoAssociateReceiptTextToMappingKeywords(
          it.rawName || it.detectedName,
          it.natureId,
          it.targetMappingId,
          updateMapping,
          natures,
          it.matchedMappingItemId
        );
      }
    });

    const res = associateReceiptItemsToInvoice(selectedInvoiceId, items);
    if (res.success) {
      setNotificationMsg(
        `✓ ${res.itemsCount} itens vinculados à fatura ${res.invoiceTitle}! Restante não mapeado: ${res.newUnanalyzed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      );
      setTimeout(() => {
        onConfirm(messageId, {
          ...data,
          store,
          date,
          totalAmount,
          paymentMethod: 'CARTAO',
          items,
          isReconciled: true,
        });
      }, 900);
    }
  };

  if (data.isReconciled) {
    return (
      <div className="receipt-reconciliation-card is-reconciled animate-fade-in">
        <div className="reconciled-header-badge">
          <Check size={16} className="text-emerald" />
          <span>Conciliação Concluída e Mapeamentos Atualizados</span>
        </div>
        <p className="reconciled-desc">
          Os itens e preços foram integrados ao seu fluxo de caixa e o Forseti aprendeu as associações para os próximos cupons.
        </p>
      </div>
    );
  }

  return (
    <div className="receipt-reconciliation-card animate-fade-in">
      {/* Header Resumo Editável */}
      <div className="reconciliation-top-bar">
        <div className="reconciliation-title-group">
          <div className="rec-icon-badge">
            <ShoppingBag size={18} />
          </div>
          <div>
            <h4 className="rec-title">Itens do cupom</h4>
            <span className="rec-subtitle">Associe os itens aos gastos fixos; o Forseti memoriza.</span>
          </div>
        </div>

        <button
          type="button"
          className="rec-toggle-edit-btn"
          onClick={() => setIsEditingHeader(!isEditingHeader)}
        >
          <Edit2 size={13} />
          <span>{isEditingHeader ? 'Salvar' : 'Editar'}</span>
        </button>
      </div>

      {/* Faixa de Parâmetros Principais */}
      <div className="reconciliation-params-grid">
        <div className="rec-param-box">
          <div className="param-label-row">
            <Store size={13} className="text-cyan" />
            <span>Estabelecimento</span>
          </div>
          {isEditingHeader ? (
            <input
              type="text"
              className="rec-inline-input"
              value={store}
              onChange={(e) => setStore(e.target.value)}
            />
          ) : (
            <span className="param-value-text">{store}</span>
          )}
        </div>

        <div className="rec-param-box">
          <div className="param-label-row">
            <Calendar size={13} className="text-cyan" />
            <span>Data do Cupom</span>
          </div>
          {isEditingHeader ? (
            <DateInput
              type="date"
              className="rec-inline-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          ) : (
            <span className="param-value-text">{date.split('-').reverse().join('/')}</span>
          )}
        </div>

        <div className="rec-param-box highlight-amount">
          <div className="param-label-row">
            <DollarSign size={13} className="text-emerald" />
            <span>Total da Compra</span>
          </div>
          {isEditingHeader ? (
            <DecimalInput
              className="rec-inline-input"
              value={totalAmount}
              onValueChange={setTotalAmount}
            />
          ) : (
            <span className="param-value-amount">
              {totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          )}
        </div>

        <div className="rec-param-box">
          <div className="param-label-row">
            <Wallet size={13} className="text-cyan" />
            <span>Forma de Pagamento</span>
          </div>
          <select
            className="rec-inline-select"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as any)}
          >
            <option value="DINHEIRO">💵 Dinheiro em Espécie</option>
            <option value="DEBITO">🏦 Débito / PIX</option>
            <option value="CARTAO">💳 Cartão de Crédito</option>
          </select>
        </div>
      </div>

      {/* Notificação Toast de Criação de Item */}
      {notificationMsg && (
        <div className="qm-notification-toast animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* Lista de Itens do Cupom */}
      <div className="reconciliation-items-section">
        <div className="items-section-header">
          <div className="items-count-badge">
            <Sparkles size={13} />
            <span>{items.length} Itens Identificados na Nota</span>
          </div>
        </div>

        <div className="rec-items-table-wrap">
          <table className="rec-items-table">
            <thead>
              <tr>
                <th>Item no Cupom</th>
                <th className="col-amount" style={{ width: '130px' }}>Valor Pago</th>
                <th>Associação ao Mapeamento</th>
                <th style={{ width: '150px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const isMapped = !!it.targetMappingId;
                const isNewSuggested = it.isNewSuggestedItem;

                return (
                  <tr key={it.id} className={isNewSuggested ? 'row-new-suggested' : ''}>
                    <td>
                      <div className="item-name-cell">
                        <span className="item-primary-name">{it.detectedName}</span>
                        {it.rawName !== it.detectedName && (
                          <span className="item-raw-subtitle">{it.rawName}</span>
                        )}
                      </div>
                    </td>

                    <td className="col-amount">
                      <div className="item-price-input-wrap">
                        <span className="currency-prefix">R$</span>
                        <DecimalInput
                          className="item-price-input"
                          value={it.price}
                          onValueChange={(v) => handleItemPriceChange(it.id, v)}
                        />
                      </div>
                    </td>

                    <td className="mapping-combobox-cell">
                      <MappingCombobox
                        options={buildComboboxOptions(it)}
                        value={
                          it.isNewSuggestedItem
                            ? 'NEW_ITEM_ZERO_QTY'
                            : it.targetMappingId || 'UNMAPPED_AVULSO'
                        }
                        onChange={(val) => handleItemMappingChange(it.id, val)}
                        placeholder="Buscar mapeamento..."
                      />
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {isMapped ? (
                        <span
                          className={`badge item-status-badge ${it.aiSuggested ? 'badge-amber' : 'badge-emerald'}`}
                          title={it.aiSuggested ? 'A Forseti sugeriu este mapeamento. Confira e troque se estiver errado.' : undefined}
                        >
                          {it.aiSuggested ? <Sparkles size={11} /> : <Check size={11} />} {it.aiSuggested ? 'Sugerido' : 'Mapeado'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn-create-mapping-action animate-fade-in"
                          onClick={() => handleOpenCreateModal(it)}
                          title="Abrir formulário imediato para cadastrar este item na rotina da natureza"
                        >
                          <Plus size={12} />
                          <span>Criar no Mapeamento</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Opção de Vincular Diretamente à Fatura de Cartão (Consumir Valor Não Mapeado) */}
      {cardInvoices.length > 0 && (
        <div className="reconciliation-invoice-link-card my-3 p-3.5 rounded-xl border border-cyan-500/25 bg-cyan-950/20 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
            <CreditCard size={15} />
            <span>Foi no cartão? Abater de uma fatura</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <select
              className="rec-inline-select flex-1 min-w-[240px] text-xs py-1.5"
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
            >
              {cardInvoices.map((inv) => {
                const unmapped = inv.unanalyzedAmount ?? inv.amount;
                return (
                  <option key={inv.id} value={inv.id}>
                    {inv.bank} — {inv.title} (Não mapeado: {unmapped.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                  </option>
                );
              })}
            </select>

            <button
              type="button"
              className="btn btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/30 text-cyan-300 font-medium cursor-pointer"
              onClick={handleLinkToInvoice}
              disabled={!selectedInvoiceId}
            >
              <Check size={13} />
              <span>Abater desta fatura</span>
            </button>
          </div>
        </div>
      )}

      {/* Rodapé com Ação Principal de Conciliação */}
      <div className="reconciliation-footer-action">
        <div className="rec-footer-summary">
          <AlertCircle size={15} className="text-cyan" />
          <span>Cria o lançamento e memoriza as associações.</span>
        </div>

        <button type="button" className="btn btn-primary rec-confirm-btn" onClick={handleConfirm}>
          <Check size={16} />
          <span>
            Confirmar (
            {totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
          </span>
        </button>
      </div>

      {/* Modal de Criação Imediata de Item de Mapeamento */}
      <QuickCreateMappingItemModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalItem(null);
        }}
        receiptItem={modalItem}
        natures={natures}
        onSaveAndAssociate={handleSaveAndAssociateNewItem}
        onAddNewRoutine={addMappingToNature}
      />
    </div>
  );
};
