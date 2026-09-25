import React, { useState } from 'react';
import type { ReceiptReconciliationData, ReceiptItemLine, ExpenseNature } from '../types';
import { useFinancial } from '../context/FinancialContext';
import { QuickCreateMappingItemModal } from './QuickCreateMappingItemModal';
import { MappingCombobox } from './MappingCombobox';
import type { ComboboxOption } from './MappingCombobox';
import { learnReceiptItemAssociation, autoAssociateReceiptTextToItemKeywords } from '../services/receiptMemoryService';
import { Check, Plus, Edit2, AlertCircle, ShoppingBag, Sparkles, Store, Calendar, DollarSign, Wallet, CheckCircle2, CreditCard } from 'lucide-react';

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
  const { addItemToMapping, updateMappingItem, addMappingToNature, movements, associateReceiptItemsToInvoice } = useFinancial();
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

  // Mapear todas as opções disponíveis de itens fixos no Balder (estrutura raw)
  const availableMappingOptions: { id: string; routineId: string; routineName: string; label: string; natureId: string }[] = [];
  natures.forEach((nat) => {
    nat.mappings.forEach((map) => {
      map.items.forEach((item) => {
        availableMappingOptions.push({
          id: item.id,
          routineId: map.id,
          routineName: map.name,
          label: item.description,
          natureId: nat.id,
        });
      });
    });
  });

  // Opções formatadas para o combobox com grupos por rotina
  const buildComboboxOptions = (forItem: ReceiptItemLine): ComboboxOption[] => {
    const regular: ComboboxOption[] = availableMappingOptions.map((opt) => ({
      value: opt.id,
      label: opt.label,
      sublabel: opt.routineName,
      group: opt.routineName,
      isMatched: forItem.matchedMappingItemId === opt.id,
    }));

    const specials: ComboboxOption[] = [
      {
        value: 'NEW_ITEM',
        label: 'Mapear como Novo Item',
        sublabel: 'Criar e vincular na rotina',
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
      learnReceiptItemAssociation(
        targetItem.detectedName,
        createdItemId,
        mappingId,
        natureId
      );
    }

    // 3. Atualizar a linha na tabela de conciliação imediatamente
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== receiptItemId) return it;
        return {
          ...it,
          matchedMappingItemId: createdItemId,
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
            isNewSuggestedItem: true,
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
            isNewSuggestedItem: false,
          };
        })
      );
      return;
    }

    const foundOpt = availableMappingOptions.find((opt) => opt.id === targetOptId);
    if (targetIt && foundOpt) {
      autoAssociateReceiptTextToItemKeywords(
        targetIt.rawName || targetIt.detectedName,
        targetOptId,
        foundOpt.natureId,
        foundOpt.routineId,
        updateMappingItem,
        natures
      );
    }

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          matchedMappingItemId: targetOptId,
          targetMappingId: foundOpt?.routineId,
          natureId: foundOpt?.natureId || 'nat_alimentacao',
          isNewSuggestedItem: false,
        };
      })
    );
  };

  const handleItemPriceChange = (itemId: string, newPriceStr: string) => {
    const parsed = parseFloat(newPriceStr.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) return;

    setItems((prev) => {
      const updated = prev.map((it) => (it.id === itemId ? { ...it, price: parsed } : it));
      const newTotal = Math.round(updated.reduce((acc, curr) => acc + curr.price, 0) * 100) / 100;
      setTotalAmount(newTotal);
      return updated;
    });
  };

  const handleConfirm = () => {
    items.forEach((it) => {
      if (it.matchedMappingItemId && it.natureId && it.targetMappingId) {
        autoAssociateReceiptTextToItemKeywords(
          it.rawName || it.detectedName,
          it.matchedMappingItemId,
          it.natureId,
          it.targetMappingId,
          updateMappingItem,
          natures
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
      if (it.matchedMappingItemId && it.natureId && it.targetMappingId) {
        autoAssociateReceiptTextToItemKeywords(
          it.rawName || it.detectedName,
          it.matchedMappingItemId,
          it.natureId,
          it.targetMappingId,
          updateMappingItem,
          natures
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
            <h4 className="rec-title">Conciliação Inteligente de Itens da Nota</h4>
            <span className="rec-subtitle">
              Relacione os itens comprados aos gastos fixos. Os preços variam a cada compra e o Forseti memoriza suas associações.
            </span>
          </div>
        </div>

        <button
          type="button"
          className="rec-toggle-edit-btn"
          onClick={() => setIsEditingHeader(!isEditingHeader)}
        >
          <Edit2 size={13} />
          <span>{isEditingHeader ? 'Salvar Cabeçalho' : 'Editar Dados Gerais'}</span>
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
            <input
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
            <input
              type="number"
              step="0.01"
              className="rec-inline-input"
              value={totalAmount}
              onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
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
            <option value="DINHEIRO">💵 Dinheiro em Espécie (Pago R$ 315 / Troco R$ 46,80)</option>
            <option value="DEBITO">🟠 Banco Inter (Débito / PIX)</option>
            <option value="CARTAO">💳 Cartão Nubank Mastercard Black</option>
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
          <span className="items-hint-text">
            Itens sem mapeamento podem ser cadastrados na hora com <strong>quantidade 0</strong> para facilitar compras futuras.
          </span>
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
                const isMapped = !!it.matchedMappingItemId;
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
                        <input
                          type="number"
                          step="0.01"
                          className="item-price-input"
                          value={it.price}
                          onChange={(e) => handleItemPriceChange(it.id, e.target.value)}
                        />
                      </div>
                    </td>

                    <td className="mapping-combobox-cell">
                      <MappingCombobox
                        options={buildComboboxOptions(it)}
                        value={
                          it.isNewSuggestedItem
                            ? 'NEW_ITEM_ZERO_QTY'
                            : it.matchedMappingItemId || 'UNMAPPED_AVULSO'
                        }
                        onChange={(val) => handleItemMappingChange(it.id, val)}
                        placeholder="Buscar rotina ou item..."
                      />
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {isMapped ? (
                        <span className="badge badge-emerald item-status-badge">
                          <Check size={11} /> Mapeado
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
            <span>Vincular Itens a uma Fatura de Cartão (Consumir Valor Não Mapeado)</span>
          </div>
          <p className="text-[11px] text-muted leading-relaxed">
            Se essas fotos pertencem a compras na fatura, você pode associar os itens diretamente à fatura aberta, abatendo o total do valor não mapeado e classificando cada produto na natureza correta.
          </p>

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
              <span>Abater do Não Mapeado desta Fatura</span>
            </button>
          </div>
        </div>
      )}

      {/* Rodapé com Ação Principal de Conciliação */}
      <div className="reconciliation-footer-action">
        <div className="rec-footer-summary">
          <AlertCircle size={15} className="text-cyan" />
          <span>
            Ao confirmar, o Forseti criará o lançamento de{' '}
            <strong>
              {totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </strong>
            , atualizará os valores realizados nos seus gastos fixos e aprenderá essas associações para os próximos cupons.
          </span>
        </div>

        <button type="button" className="btn btn-primary rec-confirm-btn" onClick={handleConfirm}>
          <Check size={16} />
          <span>
            Confirmar Conciliação & Mapeamentos (
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
