import { PERMISSION_DEFS, type SharePermissionKey, hasPermission } from '../../services/sharingService';
import { type Movement, type SharedScenario, type SharedSettlementItem } from '../../types';
import { type ViewingAccount } from '../AccountScopeContext';

// Dados de exemplo do Planejamento Compartilhado (modo convidado): parceira fictícia e 4 despesas
const DEMO_SETTLEMENT_IDS = new Set(['settle_1', 'settle_2', 'settle_3', 'settle_4']);
export const withoutDemoPartner = (s: SharedScenario | null): SharedScenario | null =>
  s && (s.members || []).some((m) => m.id === 'partner_1' && m.email === 'camila@email.com') ? null : s;
export const withoutDemoSettlements = (list: SharedSettlementItem[]): SharedSettlementItem[] =>
  (Array.isArray(list) ? list : []).filter((x) => !DEMO_SETTLEMENT_IDS.has(x.id));

// ── Permissões na conta compartilhada ─────────────────────────────────────────
// Leitura, simulação e navegação: liberadas para todos
const SHARED_READ_ONLY_SAFE = new Set([
  'getMonthlyClosing',
  'runSimulation',
  'simulateCustomFutureScenario',
  'exportToCSV',
  'getNatureCeiling',
  'getNatureSpent',
  'getNatureMissingItems',
  'setActiveTrackingScope',
  'setProjectionHorizonMonths',
  'setViewPreferences',
  // Forseti: conversa liberada; ela mesma confere o papel antes de gravar (forsetiBlockedInShared)
  'sendMessageToCopilot',
  'respondToCopilotOption',
  'confirmForsetiAction',
  'registerForsetiNavigator',
  'updatePaymentWizard',
  'confirmPaymentWizard',
  'cancelPaymentWizard',
  'reconcileReceiptData',
]);
// Ações do colaborador e a permissão que cada uma exige (o banco confere as mesmas regras)
const COLLABORATOR_ACTIONS: Record<string, SharePermissionKey> = {
  updateMovement: 'REGISTRAR_PAGAMENTOS',
  toggleMovementStatus: 'REGISTRAR_PAGAMENTOS',
  updateMappingItemState: 'REGISTRAR_PAGAMENTOS',
  toggleItemFulfilled: 'REGISTRAR_PAGAMENTOS',
  markMappingItemsFulfilled: 'REGISTRAR_PAGAMENTOS',
  addSharedSettlement: 'DESPESAS_CONJUNTAS',
  toggleSharedSettlementStatus: 'DESPESAS_CONJUNTAS',
  settleAllSharedDebts: 'DESPESAS_CONJUNTAS',
  addMovement: 'LANCAR_DESPESAS', // receitas: LANCAR_RECEITAS (ver abaixo)
  addItemToMapping: 'EDITAR_NATUREZAS',
  updateMappingItem: 'EDITAR_NATUREZAS',
  deleteMappingItem: 'EDITAR_NATUREZAS',
  moveMappingItem: 'EDITAR_NATUREZAS',
  addMappingToNature: 'EDITAR_NATUREZAS',
  updateMapping: 'EDITAR_NATUREZAS',
  deleteMapping: 'EDITAR_NATUREZAS',
  moveMappingOrder: 'EDITAR_NATUREZAS',
  reorderMappings: 'EDITAR_NATUREZAS',
};
// Campos que o colaborador pode alterar num lançamento
const PAYMENT_FIELDS = new Set(['status', 'paymentDate', 'actualAmount', 'amount', 'originalAmount', 'adjustmentReason', 'notes']);
// Campos de um item de natureza que são registro de pagamento (o resto é edição do item)
const ITEM_PAYMENT_FIELDS = new Set(['payments', 'monthStates', 'isFulfilled', 'realizedValue']);

export const PERMISSION_LABEL: Record<SharePermissionKey, string> = Object.fromEntries(
  PERMISSION_DEFS.map((d) => [d.key, d.label.toLowerCase()])
) as Record<SharePermissionKey, string>;

let lastDeniedAt = 0;
export const denySharedAction = (message: string) => {
  // Evita alertas repetidos quando uma tela dispara várias ações de uma vez
  if (Date.now() - lastDeniedAt < 1500) return;
  lastDeniedAt = Date.now();
  window.alert(message);
};

/**
 * Na conta de outra pessoa: visualizador só vê; o colaborador faz o que as permissões dele liberam
 * (definidas por quem compartilhou). Receitas próprias (em que ele é o responsável) ele sempre confirma.
 * As regras do banco (supabase/sharing.sql) garantem o mesmo do lado do servidor.
 */
export function restrictForSharedAccess<T extends Record<string, unknown>>(
  value: T,
  viewing: ViewingAccount | null,
  viewerId: string | undefined
): T {
  if (!viewing) return value;
  const isCollaborator = viewing.role === 'COLABORADOR';
  const can = (key: SharePermissionKey) => isCollaborator && hasPermission(viewing.permissions, key);
  const movements = (value.movements as Movement[]) || [];
  const isOwnIncome = (id: string) => {
    const m = movements.find((x) => x.id === id);
    return !!m && m.type === 'RECEBER' && !!viewerId && m.responsibleId === viewerId;
  };
  const deny = (key?: SharePermissionKey) =>
    denySharedAction(
      !isCollaborator
        ? `Você está vendo a conta de ${viewing.ownerName} como visualizador: não é possível alterar nada.`
        : key
        ? `Na conta de ${viewing.ownerName}, você não tem a permissão "${PERMISSION_LABEL[key]}". Peça a ${viewing.ownerName} para liberar.`
        : `Na conta de ${viewing.ownerName}, isso só pode ser feito por quem compartilhou.`
    );

  const restricted: Record<string, unknown> = { ...value };
  Object.entries(value).forEach(([key, fn]) => {
    if (typeof fn !== 'function' || SHARED_READ_ONLY_SAFE.has(key)) return;
    const needed = COLLABORATOR_ACTIONS[key];
    const call = fn as (...args: unknown[]) => unknown;

    if (key === 'updateMovement') {
      restricted[key] = (id: string, updates: Record<string, unknown>) => {
        if (!isOwnIncome(id) && !can('REGISTRAR_PAGAMENTOS')) return deny(isCollaborator ? 'REGISTRAR_PAGAMENTOS' : undefined);
        const allowed = Object.fromEntries(Object.entries(updates || {}).filter(([k]) => PAYMENT_FIELDS.has(k)));
        if (Object.keys(allowed).length === 0) return deny();
        return call(id, allowed);
      };
      return;
    }
    if (key === 'toggleMovementStatus') {
      restricted[key] = (id: string) =>
        isOwnIncome(id) || can('REGISTRAR_PAGAMENTOS') ? call(id) : deny(isCollaborator ? 'REGISTRAR_PAGAMENTOS' : undefined);
      return;
    }
    if (key === 'addMovement') {
      restricted[key] = (item: Movement) => {
        if (item?.type === 'RECEBER') {
          // Receita lançada pelo colaborador é dele: só ele confirma
          return can('LANCAR_RECEITAS') ? call({ ...item, responsibleId: viewerId }) : deny(isCollaborator ? 'LANCAR_RECEITAS' : undefined);
        }
        return can('LANCAR_DESPESAS') ? call(item) : deny(isCollaborator ? 'LANCAR_DESPESAS' : undefined);
      };
      return;
    }
    if (key === 'addMultipleMovements') {
      restricted[key] = (items: Movement[]) => {
        const incomes = (items || []).some((m) => m.type === 'RECEBER');
        const expenses = (items || []).some((m) => m.type !== 'RECEBER');
        if (incomes && !can('LANCAR_RECEITAS')) return deny(isCollaborator ? 'LANCAR_RECEITAS' : undefined);
        if (expenses && !can('LANCAR_DESPESAS')) return deny(isCollaborator ? 'LANCAR_DESPESAS' : undefined);
        return call((items || []).map((m) => (m.type === 'RECEBER' ? { ...m, responsibleId: viewerId } : m)));
      };
      return;
    }
    if (key === 'updateMappingItemState') {
      restricted[key] = (natureId: string, mappingId: string, itemId: string, state: Record<string, unknown>) => {
        const onlyPayment = Object.keys(state || {}).every((k) => ITEM_PAYMENT_FIELDS.has(k));
        const perm: SharePermissionKey = onlyPayment ? 'REGISTRAR_PAGAMENTOS' : 'EDITAR_NATUREZAS';
        return can(perm) ? call(natureId, mappingId, itemId, state) : deny(isCollaborator ? perm : undefined);
      };
      return;
    }
    if (needed) {
      restricted[key] = (...args: unknown[]) => (can(needed) ? call(...args) : deny(isCollaborator ? needed : undefined));
      return;
    }
    restricted[key] = () => deny();
  });
  return restricted as T;
}
