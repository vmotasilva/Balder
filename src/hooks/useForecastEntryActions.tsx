import { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { useAuth } from '../context/AuthContext';
import { useAccountScope } from '../context/AccountScopeContext';
import { getItemOccurrences, waiveMappingPeriod } from '../utils/mappingItemState';
import { trackingPeriodRange } from '../utils/periodSpending';
import type { ForecastEntry } from '../utils/forecastWindow';
import type { Movement } from '../types';
import type { PaymentHow } from '../utils/paymentHow';
import { CASH_IN_HAND } from '../utils/cashInHand';
import { listPaymentInstitutions } from '../utils/paymentInstitutions';
import { addCardPurchaseToInvoices, firstInvoiceDueDate } from '../utils/cardPurchase';
import { installmentSchedule } from '../utils/forsetiAssistant';
import { MappingItemStateModal, type MappingItemStateTarget } from '../components/MappingItemStateModal';
import { MappingPaymentModal, type MappingPaymentTarget } from '../components/MappingPaymentModal';
import { ConfirmDialog, useConfirmDialog } from '../components/ConfirmDialog';
import { RealizationConfirmModal, realizedMovementUpdates, type RealizationTarget } from '../components/RealizationConfirmModal';

/**
 * Ação de cada lançamento previsto (Já paguei / Já recebi / Lançar) e os pop-ups que ela abre.
 * Compartilhado entre o Início e o pop-up de contas em aberto da Central.
 * `onNavigate` é o plano B quando o lançamento não é encontrado para agir aqui mesmo.
 */
export function useForecastEntryActions(onNavigate: (tab: 'FATURAS' | 'NATUREZAS') => void) {
  const { user } = useAuth();
  const { viewing } = useAccountScope();
  const { movements, natures, updateMovement, updateMappingItemState, sharedScenario, addMovement, markMappingItemsFulfilled, accounts, cards, banks } = useFinancial();

  const [mappingPayment, setMappingPayment] = useState<MappingPaymentTarget | null>(null);
  const [realization, setRealization] = useState<RealizationTarget | null>(null);
  const [itemState, setItemState] = useState<MappingItemStateTarget | null>(null);
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();

  /**
   * Como o pagamento foi feito (mesmas escolhas da Forseti): dinheiro em mãos e débito saem do saldo na data do
   * pagamento (banco gravado no lançamento); crédito entra na fatura do banco como item (o saldo só muda quando
   * a fatura for paga). `link` liga o gasto ao item da natureza e `existing` é a conta prevista que ele quita.
   */
  const settleWithHow = (params: {
    how: PaymentHow;
    title: string;
    amount: number;
    date: string;
    dueDate: string;
    category: string;
    link?: { natureId: string; mappingId: string; itemId: string };
    existing?: Movement;
  }) => {
    const { how, title, amount, date, dueDate, category, link, existing } = params;
    const natureFields = link
      ? { natureId: link.natureId, mappingId: link.mappingId, mappingItemId: link.itemId }
      : existing?.natureId
      ? { natureId: existing.natureId, mappingId: existing.mappingId, mappingItemId: existing.mappingItemId }
      : {};
    if (how.where === 'BANK' && how.method === 'CREDITO') {
      const inst = listPaymentInstitutions(accounts, cards, banks).find((i) => i.name === how.institution);
      const terms = inst?.terms;
      const firstDue = firstInvoiceDueDate(date, terms?.closingDay, terms?.dueDay);
      const nature = natureFields.natureId ? natures.find((n) => n.id === natureFields.natureId) : undefined;
      addCardPurchaseToInvoices(
        {
          institution: how.institution,
          title,
          total: amount,
          natureId: natureFields.natureId,
          natureName: nature?.name,
          mappingId: natureFields.mappingId,
          mappingItemId: natureFields.mappingItemId,
          purchaseDate: date,
          notes: 'Pago no crédito ao confirmar o pagamento.',
        },
        how.installments > 1 ? installmentSchedule(amount, how.installments, firstDue, terms?.dueDay) : [{ dueDate: firstDue, amount }],
        movements,
        { addMovement, updateMovement }
      );
      // A conta prevista foi para a fatura: sai da lista de contas em aberto
      if (existing) updateMovement(existing.id, { status: 'CANCELADA', notes: `Pago no crédito (${how.institution}).` });
    } else {
      const bank =
        how.where === 'CASH'
          ? CASH_IN_HAND
          : listPaymentInstitutions(accounts, cards, banks).find((i) => i.name === how.institution)?.account?.name ?? how.institution;
      if (existing) {
        updateMovement(existing.id, { ...realizedMovementUpdates(existing, amount, date), bank });
      } else {
        addMovement({ title, type: 'PAGAR', amount, dueDate, bank, status: 'REALIZADA', category, paymentDate: date, actualAmount: amount, ...natureFields });
      }
    }
    // O item da natureza passa a pago com o valor e a data informados
    if (link) {
      markMappingItemsFulfilled([{ ...link, realizedValue: amount, monthKey: dueDate.slice(0, 7), paidAt: date }]);
    }
  };

  const findNatureItem = (entry: ForecastEntry) => {
    const itemId = entry.id.replace(/^nat_/, '').replace(/_(overdue|upcoming)$/, '');
    for (const nat of natures) {
      for (const mapping of nat.mappings) {
        const item = mapping.items.find((it) => it.id === itemId);
        if (item) return { nat, mapping, item };
      }
    }
    return null;
  };

  const renderAction = (entry: ForecastEntry) => {
    // Fatura: confirma o pagamento aqui mesmo (valor e data conferidos no pop-up), sem sair da tela
    if (entry.source === 'FATURA') {
      const invoice = movements.find((m) => m.id === entry.id);
      return (
        <button
          type="button"
          className="btn btn-outline btn-xs"
          onClick={() =>
            invoice
              ? setRealization({
                  kind: 'SAIDA',
                  title: entry.title,
                  expectedAmount: invoice.amount,
                  dueDate: invoice.dueDate,
                  onConfirm: (amount, date) => updateMovement(invoice.id, realizedMovementUpdates(invoice, amount, date)),
                })
              : onNavigate('FATURAS')
          }
        >
          Já paguei
        </button>
      );
    }
    if (entry.source === 'NATUREZA' && entry.mappingSummary && entry.natureId && entry.mappingId) {
      const mapping = natures.find((n) => n.id === entry.natureId)?.mappings.find((m) => m.id === entry.mappingId);
      return (
        <button
          type="button"
          className="btn btn-outline btn-xs"
          onClick={() =>
            mapping &&
            setMappingPayment({
              natureId: entry.natureId!,
              mappingId: mapping.id,
              itemIds: mapping.items.filter((it) => it.paymentMethod !== 'CARTAO').map((it) => it.id),
              monthKey: entry.date.slice(0, 7),
              title: mapping.name,
              forecastDate: entry.date,
            })
          }
        >
          Lançar
        </button>
      );
    }
    if (entry.source === 'NATUREZA') {
      const found = findNatureItem(entry);
      const monthKey = entry.date.slice(0, 7);
      // Itens com uma cobrança no mês: um toque registra o pagamento de hoje; os demais abrem a natureza
      const occurrences = found ? getItemOccurrences(found.item, monthKey) : [];
      if (found && occurrences.length === 1) {
        const { item } = found;
        return (
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={() =>
              setRealization({
                kind: 'SAIDA',
                title: entry.title,
                expectedAmount: entry.amount,
                dueDate: occurrences[0].date,
                askHow: true,
                onConfirm: (amount, paidAt, how) =>
                  how
                    ? settleWithHow({
                        how,
                        title: entry.title,
                        amount,
                        date: paidAt,
                        dueDate: occurrences[0].date,
                        category: found.nat.name,
                        link: { natureId: found.nat.id, mappingId: found.mapping.id, itemId: item.id },
                      })
                    : updateMappingItemState(found.nat.id, found.mapping.id, item.id, {
                    payments: {
                      ...(item.payments || {}),
                      [monthKey]: [
                        ...(item.payments?.[monthKey] || []),
                        {
                          id: `pay_${Date.now()}`,
                          paidAt,
                          amount,
                          expectedAmount: entry.amount,
                          coveredDates: [occurrences[0].date],
                        },
                      ],
                    },
                  }),
              })
            }
          >
            Já paguei
          </button>
        );
      }
      // Sem atalho direto: abre o pop-up do item, para dizer como foi tratado (realizado, quem pagou, pular)
      return (
        <button
          type="button"
          className="btn btn-outline btn-xs"
          onClick={() =>
            found
              ? setItemState({ natureId: found.nat.id, mappingId: found.mapping.id, itemId: found.item.id, monthKey, occurrenceDate: entry.date })
              : onNavigate('NATUREZAS')
          }
        >
          Lançar
        </button>
      );
    }
    // Receita de outra pessoa: só quem recebe confirma
    const mov = movements.find((m) => m.id === entry.id);
    const confirmer = mov?.type === 'RECEBER' ? mov.responsibleId || viewing?.ownerId || user?.$id : undefined;
    if (confirmer && user && !user.isGuest && confirmer !== user.$id) {
      const name =
        sharedScenario?.members?.find((p) => p.id === confirmer)?.name ||
        (confirmer === viewing?.ownerId ? viewing?.ownerName : undefined) ||
        'quem recebe';
      return <span className="home-task-owner">Só {name.split(' ')[0]} confirma</span>;
    }
    return (
      <button
        type="button"
        className="btn btn-outline btn-xs"
        onClick={() =>
          mov
            ? setRealization({
                kind: entry.kind === 'ENTRADA' ? 'ENTRADA' : 'SAIDA',
                title: entry.title,
                expectedAmount: mov.amount,
                dueDate: mov.dueDate,
                askHow: entry.kind !== 'ENTRADA',
                onConfirm: (amount, date, how) =>
                  how
                    ? settleWithHow({ how, title: mov.title, amount, date, dueDate: mov.dueDate, category: mov.category, existing: mov })
                    : updateMovement(mov.id, realizedMovementUpdates(mov, amount, date)),
              })
            : undefined
        }
      >
        {entry.kind === 'ENTRADA' ? 'Já recebi' : 'Já paguei'}
      </button>
    );
  };

  /**
   * Segunda saída para o que não é pagar/receber: itens de natureza abrem o pop-up de situação (pular,
   * pago por outra pessoa...) e lançamentos soltos podem ser desconsiderados (viram cancelados).
   */
  const renderSecondary = (entry: ForecastEntry) => {
    // Mapeamento em Resumo: tira do previsto a compra da semana, sem lançar pagamento
    if (entry.source === 'NATUREZA' && entry.mappingSummary && entry.natureId && entry.mappingId) {
      const mapping = natures.find((n) => n.id === entry.natureId)?.mappings.find((m) => m.id === entry.mappingId);
      if (!mapping) return null;
      const monthKey = entry.date.slice(0, 7);
      const week = trackingPeriodRange('SEMANA', new Date(Number(entry.date.slice(0, 4)), Number(entry.date.slice(5, 7)) - 1, Number(entry.date.slice(8, 10))));
      const monthStart = `${monthKey}-01`;
      const range = { from: week.from < monthStart ? monthStart : week.from, to: week.to };
      const scope = { items: mapping.items.filter((it) => it.paymentMethod !== 'CARTAO') };
      return (
        <button
          type="button"
          className="btn btn-secondary btn-xs"
          onClick={() =>
            confirmAction({
              title: 'Desconsiderar previsto',
              message: `A compra prevista de ${mapping.name} nesta semana deixa de contar no previsto. Nenhum pagamento é lançado.`,
              confirmLabel: 'Desconsiderar',
              variant: 'warning',
              onConfirm: () =>
                waiveMappingPeriod(scope, monthKey, range).changes.forEach((c) =>
                  updateMappingItemState(entry.natureId!, mapping.id, c.itemId, c.patch)
                ),
            })
          }
        >
          Desconsiderar
        </button>
      );
    }
    if (entry.source === 'NATUREZA') {
      const found = entry.mappingSummary ? null : findNatureItem(entry);
      if (!found) return null;
      return (
        <button
          type="button"
          className="btn btn-secondary btn-xs"
          onClick={() =>
            setItemState({
              natureId: found.nat.id,
              mappingId: found.mapping.id,
              itemId: found.item.id,
              monthKey: entry.date.slice(0, 7),
              occurrenceDate: entry.date,
            })
          }
        >
          Outra situação
        </button>
      );
    }
    const mov = movements.find((m) => m.id === entry.id);
    if (!mov) return null;
    return (
      <button
        type="button"
        className="btn btn-secondary btn-xs"
        onClick={() =>
          confirmAction({
            title: 'Desconsiderar lançamento',
            message: `${mov.title} deixa de contar no saldo previsto e fica como cancelado.`,
            confirmLabel: 'Desconsiderar',
            variant: 'warning',
            onConfirm: () => updateMovement(mov.id, { status: 'CANCELADA' }),
          })
        }
      >
        Desconsiderar
      </button>
    );
  };

  const modals = (
    <>
      <MappingItemStateModal target={itemState} onClose={() => setItemState(null)} />
      <MappingPaymentModal target={mappingPayment} onClose={() => setMappingPayment(null)} />
      <RealizationConfirmModal target={realization} onClose={() => setRealization(null)} />
      <ConfirmDialog {...dialogProps} />
    </>
  );

  return { renderAction, renderSecondary, modals };
}
