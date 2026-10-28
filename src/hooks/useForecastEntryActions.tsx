import { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { usePaymentSettle } from './usePaymentSettle';
import { useAuth } from '../context/AuthContext';
import { useAccountScope } from '../context/AccountScopeContext';
import { getItemOccurrences, registerItemPayment, registerMappingPayment, resolveMappingItemMonth, resolveMappingMonth } from '../utils/mappingItemState';
import type { ForecastEntry } from '../utils/forecastWindow';
import { MappingItemStateModal, type MappingItemStateTarget } from '../components/MappingItemStateModal';
import { MappingPaymentModal, type MappingPaymentTarget } from '../components/MappingPaymentModal';
import { ConfirmDialog, useConfirmDialog } from '../components/ConfirmDialog';
import { RealizationConfirmModal, realizedMovementUpdates, type RealizationTarget } from '../components/RealizationConfirmModal';

/**
 * Ação de cada lançamento previsto (Já paguei / Já recebi / Lançar) e os pop-ups que ela abre.
 * Compartilhado entre o Início e o pop-up de contas em aberto da Central.
 * `onNavigate` é o plano B quando o lançamento não é encontrado para agir aqui mesmo.
 */
const isoToday = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

export function useForecastEntryActions(onNavigate: (tab: 'FATURAS' | 'NATUREZAS') => void) {
  const { user } = useAuth();
  const { viewing } = useAccountScope();
  const { movements, natures, updateMovement, updateMappingItemState, sharedScenario } = useFinancial();
  const settleWithHow = usePaymentSettle();

  const [mappingPayment, setMappingPayment] = useState<MappingPaymentTarget | null>(null);
  const [realization, setRealization] = useState<RealizationTarget | null>(null);
  const [itemState, setItemState] = useState<MappingItemStateTarget | null>(null);
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();

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
                onDismiss: () =>
                  updateMappingItemState(
                    found.nat.id,
                    found.mapping.id,
                    item.id,
                    registerItemPayment(item, monthKey, {
                      paidAt: isoToday(),
                      amount: 0,
                      coveredDates: [occurrences[0].date],
                      reason: 'Desconsiderado',
                      action: 'QUITADO',
                    })
                  ),
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
                onDismiss: () => updateMovement(mov.id, { status: 'CANCELADA' }),
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
      const scope = { items: mapping.items.filter((it) => it.paymentMethod !== 'CARTAO') };
      // Dispensa exatamente o valor da linha (o previsto da semana já abatido de pagamentos de outras semanas)
      const waive = Math.min(entry.amount, resolveMappingMonth(scope, monthKey).pending);
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
                registerMappingPayment(scope, monthKey, { paidAt: entry.date, amount: 0, waive }).forEach((c) =>
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

  /**
   * Desconsiderar direto, sem abrir o pop-up do item: vale para o que se resolve num toque (conta solta,
   * mapeamento em Resumo, item com uma única cobrança em aberto no mês). Nos demais, cai em "Outra situação".
   */
  const renderSkip = (entry: ForecastEntry) => {
    if (entry.source === 'NATUREZA' && !entry.mappingSummary) {
      const found = findNatureItem(entry);
      if (!found) return null;
      const monthKey = entry.date.slice(0, 7);
      const covered = resolveMappingItemMonth(found.item, monthKey).coveredDates;
      const open = getItemOccurrences(found.item, monthKey).filter((o) => !covered.has(o.date));
      if (open.length !== 1) return renderSecondary(entry);
      return (
        <button
          type="button"
          className="btn btn-secondary btn-xs"
          onClick={() =>
            confirmAction({
              title: 'Desconsiderar previsto',
              message: `${entry.title} deixa de contar no previsto deste mês. Nenhum pagamento é lançado.`,
              confirmLabel: 'Desconsiderar',
              variant: 'warning',
              onConfirm: () =>
                updateMappingItemState(
                  found.nat.id,
                  found.mapping.id,
                  found.item.id,
                  registerItemPayment(found.item, monthKey, {
                    paidAt: isoToday(),
                    amount: 0,
                    coveredDates: [open[0].date],
                    reason: 'Desconsiderado',
                    action: 'QUITADO',
                  })
                ),
            })
          }
        >
          Desconsiderar
        </button>
      );
    }
    return renderSecondary(entry);
  };

  const modals = (
    <>
      <MappingItemStateModal target={itemState} onClose={() => setItemState(null)} />
      <MappingPaymentModal target={mappingPayment} onClose={() => setMappingPayment(null)} />
      <RealizationConfirmModal target={realization} onClose={() => setRealization(null)} />
      <ConfirmDialog {...dialogProps} />
    </>
  );

  return { renderAction, renderSecondary, renderSkip, modals };
}
