import React, { useMemo, useState } from 'react';
import { Layers, CalendarDays, CalendarRange, List, ChevronRight, Search } from 'lucide-react';
import type { CellBreakdownSubItem } from './GridCellDetailModal';

/** Estilos de visualização do detalhamento da grade. */
export type DetailViewStyle = 'NATUREZAS' | 'CALENDARIO' | 'SEMANA' | 'DATA';

/** Grupo do detalhamento (natureza, fatura, avulsos...) com seus itens e ocorrências datadas. */
export interface DetailViewGroup {
  id: string;
  title: string;
  symbol: string;
  items: CellBreakdownSubItem[]; // itens do grupo (visão por natureza)
  dated: { date: string | null; item: CellBreakdownSubItem }[]; // ocorrências (null = sem data definida)
}

type RenderItem = (item: CellBreakdownSubItem) => React.ReactNode;
type FormatBRL = (v?: number) => string;

// Pago por terceiros aparece, mas não soma
const itemValue = (s: CellBreakdownSubItem) => (s.paidByOthers ? 0 : s.totalValue || 0);
const sumItems = (list: CellBreakdownSubItem[]) => Math.round(list.reduce((acc, s) => acc + itemValue(s), 0) * 100) / 100;

// Real (já pago/recebido) | Previsto (ainda a pagar/receber) de um item; itens mapeados trazem os valores do mês
const splitItem = (s: CellBreakdownSubItem) => {
  if (s.paidByOthers || s.status === 'CANCELADA') return { real: 0, planned: 0 };
  if (s.paidAmount !== undefined || s.pendingAmount !== undefined) {
    return { real: s.paidAmount || 0, planned: s.pendingAmount || 0 };
  }
  const v = s.totalValue || 0;
  return s.status === 'REALIZADA' ? { real: v, planned: 0 } : { real: 0, planned: v };
};
const splitItems = (list: CellBreakdownSubItem[]) => {
  const acc = list.reduce((a, s) => {
    const r = splitItem(s);
    return { real: a.real + r.real, planned: a.planned + r.planned };
  }, { real: 0, planned: 0 });
  return { real: Math.round(acc.real * 100) / 100, planned: Math.round(acc.planned * 100) / 100 };
};

/** Par Real | Previsto com colunas de largura fixa (alinhadas entre as linhas e com a legenda). */
const RealPlanned: React.FC<{ real: number; planned: number; formatBRL: FormatBRL }> = ({ real, planned, formatBRL }) => (
  <span className="drill-rp">
    <span className="font-mono" title="Real: já pago/recebido">{formatBRL(real)}</span>
    <span className="rp-sep" aria-hidden="true">|</span>
    <span className="rp-planned" title="Previsto: ainda a pagar/receber">
      <span className="font-mono">{formatBRL(planned)}</span>
    </span>
  </span>
);

const RealPlannedLegend: React.FC = () => (
  <div className="drill-rp-legend" aria-hidden="true">
    <span className="drill-rp">
      <span>Real</span>
      <span className="rp-sep">|</span>
      <span>Previsto</span>
    </span>
  </div>
);

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const parseIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const longDate = (iso: string) => `${ddmm(iso)}/${iso.slice(0, 4)} (${WEEKDAYS_LONG[parseIso(iso).getDay()]})`;

// Valor curto para as células do calendário (ex.: 1,2k)
const compactValue = (v: number) =>
  v >= 1000
    ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
    : Math.round(v).toLocaleString('pt-BR');

// ─── Barra de estilos ─────────────────────────────────────────────────────────

const STYLE_OPTIONS: { value: DetailViewStyle; label: string; icon: React.ReactNode; title: string }[] = [
  { value: 'NATUREZAS', label: 'Naturezas', icon: <Layers size={13} />, title: 'Natureza → mapeamentos → itens' },
  { value: 'CALENDARIO', label: 'Calendário', icon: <CalendarDays size={13} />, title: 'Símbolo e valor em cada dia do mês' },
  { value: 'SEMANA', label: 'Semana', icon: <CalendarRange size={13} />, title: 'Agrupado por semana do mês' },
  { value: 'DATA', label: 'Data', icon: <List size={13} />, title: 'Agrupado por dia' },
];

export const DetailViewStyleBar: React.FC<{ value: DetailViewStyle; onChange: (v: DetailViewStyle) => void }> = ({
  value,
  onChange,
}) => (
  <div className="detail-view-style-bar" role="group" aria-label="Estilo de visualização">
    {STYLE_OPTIONS.map((opt) => (
      <button
        key={opt.value}
        type="button"
        className={`detail-view-style-btn ${value === opt.value ? 'active' : ''}`}
        aria-pressed={value === opt.value}
        onClick={() => onChange(opt.value)}
        title={opt.title}
      >
        {opt.icon}
        <span>{opt.label}</span>
      </button>
    ))}
  </div>
);

const EmptyState: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center text-muted">
    <Search size={32} className="opacity-30 mb-2" />
    <p className="text-xs">{message || 'Nenhum lançamento encontrado para esta seleção.'}</p>
  </div>
);

/** Linha navegável (natureza ou mapeamento) com quantidade e total. */
const DrillRow: React.FC<{ symbol?: string; title: string; count: number; items: CellBreakdownSubItem[]; onClick: () => void; formatBRL: FormatBRL }> = ({
  symbol,
  title,
  count,
  items,
  onClick,
  formatBRL,
}) => {
  const { real, planned } = splitItems(items);
  return (
  <button type="button" className="detail-item-row drill-row" onClick={onClick} title={`Abrir ${title}`}>
    <div className="detail-item-main min-w-0 flex-1" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {symbol && <span className="drill-row-symbol">{symbol}</span>}
      <div className="min-w-0">
        <div className="detail-item-primary truncate">{title}</div>
        <div className="detail-item-secondary">
          {count} {count === 1 ? 'item' : 'itens'}
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      <RealPlanned real={real} planned={planned} formatBRL={formatBRL} />
      <ChevronRight size={16} className="text-muted" />
    </div>
  </button>
  );
};

// ─── Naturezas → Mapeamentos → Itens (padrão) ────────────────────────────────

const mappingKeyOf = (s: CellBreakdownSubItem) => s.natureItemRef?.mappingId || s.mappingName || '—';

export const NatureDrillView: React.FC<{
  groups: DetailViewGroup[];
  activeGroupId: string | null; // null = todas as naturezas
  onOpenGroup: (id: string | null) => void;
  mappingKey: string | null;
  onOpenMapping: (key: string | null) => void;
  renderItem: RenderItem;
  formatBRL: FormatBRL;
}> = ({ groups, activeGroupId, onOpenGroup, mappingKey, onOpenMapping, renderItem, formatBRL }) => {
  const group = activeGroupId ? groups.find((g) => g.id === activeGroupId) : undefined;

  const mappings = useMemo(() => {
    if (!group) return [];
    const map = new Map<string, { key: string; label: string; items: CellBreakdownSubItem[] }>();
    group.items.forEach((s) => {
      const key = mappingKeyOf(s);
      const cur = map.get(key) || { key, label: s.mappingName || group.title, items: [] };
      cur.items.push(s);
      map.set(key, cur);
    });
    return Array.from(map.values());
  }, [group]);

  // Um único mapeamento: vai direto aos itens
  const effectiveMappingKey = mappingKey ?? (mappings.length === 1 ? mappings[0].key : null);
  const mapping = mappings.find((m) => m.key === effectiveMappingKey);

  const breadcrumb = (
    <div className="drill-breadcrumb">
      <button type="button" onClick={() => { onOpenGroup(null); onOpenMapping(null); }} disabled={!group}>
        Todas as naturezas
      </button>
      {group && (
        <>
          <ChevronRight size={12} />
          <button type="button" onClick={() => onOpenMapping(null)} disabled={!mapping || mappings.length === 1}>
            {group.symbol} {group.title}
          </button>
        </>
      )}
      {group && mapping && mappings.length > 1 && (
        <>
          <ChevronRight size={12} />
          <span>{mapping.label}</span>
        </>
      )}
    </div>
  );

  // Nível 1: naturezas
  if (!activeGroupId) {
    const visible = groups.filter((g) => g.items.length > 0);
    return (
      <div>
        {breadcrumb}
        {visible.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="sticky-date-items-list">
            <RealPlannedLegend />
            {visible.map((g) => (
              <DrillRow
                key={g.id}
                symbol={g.symbol}
                title={g.title}
                count={g.items.length}
                items={g.items}
                onClick={() => {
                  onOpenGroup(g.id);
                  onOpenMapping(null);
                }}
                formatBRL={formatBRL}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!group) return <EmptyState />;

  // Nível 2: mapeamentos da natureza
  if (!mapping) {
    return (
      <div>
        {breadcrumb}
        {mappings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="sticky-date-items-list">
            <RealPlannedLegend />
            {mappings.map((m) => {
              const isSummary = m.items.length === 1 && m.items[0].isMappingSummary;
              return (
                <DrillRow
                  key={m.key}
                  title={m.label}
                  count={isSummary ? m.items[0].summaryItemCount || 1 : m.items.length}
                  items={m.items}
                  onClick={() => onOpenMapping(m.key)}
                  formatBRL={formatBRL}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Nível 3: itens do mapeamento
  const isSummary = mapping.items.every((s) => s.isMappingSummary);
  return (
    <div>
      {breadcrumb}
      {isSummary && (
        <p className="text-[11px] text-muted mb-2">
          Este mapeamento está em modo Resumo. Para ver cada item, altere para Detalhado na tela de Naturezas.
        </p>
      )}
      <div className="sticky-date-items-list">{mapping.items.map(renderItem)}</div>
      <div className="drill-subtotal">
        <span>Subtotal do mapeamento · Real | Previsto</span>
        {(() => {
          const { real, planned } = splitItems(mapping.items);
          return <RealPlanned real={real} planned={planned} formatBRL={formatBRL} />;
        })()}
      </div>
    </div>
  );
};

// ─── Utilidades das visões por data ──────────────────────────────────────────

interface DatedEntry {
  date: string | null;
  item: CellBreakdownSubItem;
  symbol: string;
}

const flattenDated = (groups: DetailViewGroup[]): DatedEntry[] =>
  groups.flatMap((g) => g.dated.map((d) => ({ ...d, symbol: g.symbol })));

const UndatedBlock: React.FC<{ entries: DatedEntry[]; renderItem: RenderItem; formatBRL: FormatBRL }> = ({
  entries,
  renderItem,
  formatBRL,
}) =>
  entries.length === 0 ? null : (
    <div className="sticky-date-group-block">
      <div className="sticky-date-group-header">
        <span className="sticky-date-title">📋 Sem data definida (resumos por mapeamento)</span>
        <div className="sticky-date-subtotal">
          <span className="subtotal-prefix">Subtotal:</span>
          <span className="subtotal-val">{formatBRL(sumItems(entries.map((e) => e.item)))}</span>
        </div>
      </div>
      <div className="sticky-date-items-list">{entries.map((e) => renderItem(e.item))}</div>
    </div>
  );

// ─── Por data ────────────────────────────────────────────────────────────────

export const DateGroupedView: React.FC<{ groups: DetailViewGroup[]; renderItem: RenderItem; formatBRL: FormatBRL }> = ({
  groups,
  renderItem,
  formatBRL,
}) => {
  const entries = flattenDated(groups);
  const undated = entries.filter((e) => !e.date);
  const byDate = new Map<string, DatedEntry[]>();
  entries
    .filter((e) => e.date)
    .forEach((e) => byDate.set(e.date!, [...(byDate.get(e.date!) || []), e]));
  const dates = Array.from(byDate.keys()).sort();

  if (entries.length === 0) return <EmptyState />;
  return (
    <div>
      <UndatedBlock entries={undated} renderItem={renderItem} formatBRL={formatBRL} />
      {dates.map((date) => (
        <div key={date} className="sticky-date-group-block">
          <div className="sticky-date-group-header">
            <span className="sticky-date-title">📅 {longDate(date)}</span>
            <div className="sticky-date-subtotal">
              <span className="subtotal-prefix">Subtotal:</span>
              <span className="subtotal-val">{formatBRL(sumItems(byDate.get(date)!.map((e) => e.item)))}</span>
            </div>
          </div>
          <div className="sticky-date-items-list">{byDate.get(date)!.map((e) => renderItem(e.item))}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Por semana (uma coluna por semana) ──────────────────────────────────────

export interface WeekColumnRow {
  key: string;
  symbol: string;
  title: string;
  value: number;
}

export interface WeekColumn {
  key: string;
  label: string;
  range: string;
  rows: WeekColumnRow[];
  total: number;
}

/** Semanas da competência (domingo a sábado), recortadas aos dias do mês. */
const monthWeeks = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const weeks: { start: number; end: number }[] = [];
  let start = 1;
  while (start <= daysInMonth) {
    const end = Math.min(daysInMonth, start + (6 - new Date(y, m - 1, start).getDay()));
    weeks.push({ start, end });
    start = end + 1;
  }
  return weeks;
};

/**
 * Colunas por semana: cada linha (natureza, ou mapeamento quando há uma só natureza) tem seu total do mês
 * distribuído entre as semanas proporcionalmente aos dias em que ocorre — ocorrências datadas dos itens e,
 * nos resumos por mapeamento, os dias reais dos itens agregados. A soma das colunas fecha com o total.
 */
export function buildWeekColumns(
  monthKey: string,
  groups: DetailViewGroup[],
  valueOf: (s: CellBreakdownSubItem) => number = itemValue
): { columns: WeekColumn[]; rowLevel: 'NATUREZAS' | 'MAPEAMENTOS' } {
  const weeks = monthWeeks(monthKey);
  const byMapping = groups.length === 1;
  const weekIndexOf = (iso: string) => {
    if (!iso.startsWith(monthKey)) return -1;
    const day = Number(iso.slice(8, 10));
    return weeks.findIndex((w) => day >= w.start && day <= w.end);
  };

  interface RowAcc {
    key: string;
    symbol: string;
    title: string;
    total: number;
    weights: Map<number, number>; // semana (-1 = sem data) -> peso
  }
  const rows = new Map<string, RowAcc>();
  const rowFor = (g: DetailViewGroup, s: CellBreakdownSubItem) => {
    const key = byMapping ? mappingKeyOf(s) : g.id;
    let row = rows.get(key);
    if (!row) {
      row = { key, symbol: g.symbol, title: byMapping ? s.mappingName || g.title : g.title, total: 0, weights: new Map() };
      rows.set(key, row);
    }
    return row;
  };
  const addWeight = (row: RowAcc, week: number, weight: number) => {
    if (weight > 0) row.weights.set(week, (row.weights.get(week) || 0) + weight);
  };

  groups.forEach((g) => {
    g.items.forEach((s) => {
      rowFor(g, s).total += valueOf(s);
    });
    g.dated.forEach(({ date, item }) => {
      const row = rowFor(g, item);
      if (date) {
        addWeight(row, weekIndexOf(date), itemValue(item));
      } else if (item.occurrenceWeights && item.occurrenceWeights.length > 0) {
        item.occurrenceWeights.forEach((o) => addWeight(row, weekIndexOf(o.date), o.weight));
      } else {
        addWeight(row, -1, itemValue(item));
      }
    });
  });

  const buckets = new Map<number, WeekColumnRow[]>();
  rows.forEach((row) => {
    if (row.total <= 0) return;
    const totalWeight = Array.from(row.weights.values()).reduce((a, b) => a + b, 0);
    const shares: [number, number][] = totalWeight > 0 ? Array.from(row.weights.entries()) : [[-1, 1]];
    const weightSum = totalWeight > 0 ? totalWeight : 1;
    let allocated = 0;
    shares
      .sort((a, b) => a[0] - b[0])
      .forEach(([week, weight], idx) => {
        // Última fatia recebe o resto do arredondamento, para a soma fechar com o total
        const value =
          idx === shares.length - 1
            ? Math.round((row.total - allocated) * 100) / 100
            : Math.round(((row.total * weight) / weightSum) * 100) / 100;
        allocated += value;
        if (value <= 0) return;
        buckets.set(week, [...(buckets.get(week) || []), { key: row.key, symbol: row.symbol, title: row.title, value }]);
      });
  });

  const [, m] = monthKey.split('-').map(Number);
  const pad = (d: number) => `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  const toColumn = (key: string, label: string, range: string, list: WeekColumnRow[] = []): WeekColumn => ({
    key,
    label,
    range,
    rows: [...list].sort((a, b) => b.value - a.value),
    total: Math.round(list.reduce((acc, r) => acc + r.value, 0) * 100) / 100,
  });

  const columns = weeks.map((w, idx) => toColumn(`w${idx}`, `Semana ${idx + 1}`, `${pad(w.start)} – ${pad(w.end)}`, buckets.get(idx)));
  if (buckets.has(-1)) columns.push(toColumn('sem-data', 'Sem data', 'fora do calendário', buckets.get(-1)));
  return { columns, rowLevel: byMapping ? 'MAPEAMENTOS' : 'NATUREZAS' };
}

export interface WeekSummary {
  ceiling: number;   // teto (valor planejado distribuído na semana)
  spent: number;     // realizado de fato na semana
  remaining: number; // teto - realizado (negativo = estourou)
}

/**
 * Resumo por semana, sem filtro de situação: teto = planejado distribuído pelos dias de ocorrência;
 * realizado = ocorrências/lançamentos já pagos (ou recebidos) na semana; resumos quitados são
 * distribuídos pelos dias reais dos itens agregados.
 */
export function buildWeekSummaries(monthKey: string, groups: DetailViewGroup[]): Map<string, WeekSummary> {
  const planned = (s: CellBreakdownSubItem) => (s.paidByOthers ? 0 : s.baseValue ?? s.totalValue ?? 0);
  const { columns } = buildWeekColumns(monthKey, groups, planned);

  const weeks = monthWeeks(monthKey);
  const keyOf = (iso: string) => {
    if (!iso.startsWith(monthKey)) return 'sem-data';
    const day = Number(iso.slice(8, 10));
    const idx = weeks.findIndex((w) => day >= w.start && day <= w.end);
    return idx >= 0 ? `w${idx}` : 'sem-data';
  };

  const spent = new Map<string, number>();
  const add = (key: string, v: number) => spent.set(key, (spent.get(key) || 0) + v);
  groups.forEach((g) =>
    g.dated.forEach(({ date, item }) => {
      if (item.status !== 'REALIZADA') return;
      const value = itemValue(item);
      if (value <= 0) return;
      if (date) {
        add(keyOf(date), value);
      } else if (item.occurrenceWeights && item.occurrenceWeights.length > 0) {
        const total = item.occurrenceWeights.reduce((a, o) => a + o.weight, 0);
        item.occurrenceWeights.forEach((o) => add(keyOf(o.date), total > 0 ? (value * o.weight) / total : 0));
      } else {
        add('sem-data', value);
      }
    })
  );

  const result = new Map<string, WeekSummary>();
  const keys = new Set([...columns.map((c) => c.key), ...spent.keys()]);
  keys.forEach((key) => {
    const ceiling = columns.find((c) => c.key === key)?.total || 0;
    const s = Math.round((spent.get(key) || 0) * 100) / 100;
    result.set(key, { ceiling, spent: s, remaining: Math.round((ceiling - s) * 100) / 100 });
  });
  return result;
}

export const WeekGroupedView: React.FC<{
  monthKey: string;
  groups: DetailViewGroup[];        // com o filtro Realizado/Previsto (itens listados nas colunas)
  summaryGroups: DetailViewGroup[]; // sem filtro (resumo de teto, realizado e saldo)
  kind: 'in' | 'out';
  formatBRL: FormatBRL;
}> = ({ monthKey, groups, summaryGroups, kind, formatBRL }) => {
  const { columns, rowLevel } = useMemo(() => buildWeekColumns(monthKey, groups), [monthKey, groups]);
  const summaries = useMemo(() => buildWeekSummaries(monthKey, summaryGroups), [monthKey, summaryGroups]);
  if (columns.every((c) => c.rows.length === 0) && summaryGroups.every((g) => g.items.length === 0)) {
    return <EmptyState />;
  }

  // Saídas: Teto / Gasto / Sobrou; Entradas: Previsto / Recebido / A receber
  const labels =
    kind === 'out'
      ? { ceiling: 'Teto', spent: 'Gasto', left: 'Sobrou', over: 'Estourou' }
      : { ceiling: 'Previsto', spent: 'Recebido', left: 'A receber', over: 'Acima' };

  return (
    <div>
      <div className="week-columns">
        {columns.map((col) => {
          const summary = summaries.get(col.key) || { ceiling: 0, spent: 0, remaining: 0 };
          const pct = summary.ceiling > 0 ? Math.min(100, Math.round((summary.spent / summary.ceiling) * 100)) : 0;
          const isOver = summary.remaining < 0;
          return (
          <div key={col.key} className="week-column">
            <div className="week-column-header">
              <div>
                <strong>{col.label}</strong>
                <span className="week-column-range">{col.range}</span>
              </div>
              <span className="week-column-total font-mono">{formatBRL(col.total)}</span>
            </div>
            <div className="week-column-summary">
              <div>
                <span>{labels.ceiling}</span>
                <strong className="font-mono">{formatBRL(summary.ceiling)}</strong>
              </div>
              <div>
                <span>{labels.spent}</span>
                <strong className="font-mono">{formatBRL(summary.spent)}</strong>
              </div>
              <div className={isOver ? (kind === 'out' ? 'is-over' : 'is-good') : ''}>
                <span>{isOver ? labels.over : labels.left}</span>
                <strong className="font-mono">{formatBRL(Math.abs(summary.remaining))}</strong>
              </div>
              <div className="week-column-progress" title={`${pct}% ${kind === 'out' ? 'do teto gasto' : 'do previsto recebido'}`}>
                <div className={isOver && kind === 'out' ? 'is-over' : ''} style={{ width: `${pct}%` }} />
              </div>
            </div>
            {col.rows.length === 0 ? (
              <div className="week-column-empty">Sem lançamentos</div>
            ) : (
              col.rows.map((r) => (
                <div key={r.key} className="week-column-row" title={`${r.title}: ${formatBRL(r.value)} em ${col.label}`}>
                  <span className="week-column-symbol">{r.symbol}</span>
                  <span className="week-column-name">{r.title}</span>
                  <span className="week-column-value font-mono">{formatBRL(r.value)}</span>
                </div>
              ))
            )}
          </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted mt-2">
        Valor de cada {rowLevel === 'MAPEAMENTOS' ? 'mapeamento' : 'natureza'} distribuído pelos dias em que ocorre no
        mês.
      </p>
    </div>
  );
};

// ─── Calendário ──────────────────────────────────────────────────────────────

export const CalendarView: React.FC<{
  monthKey: string;
  groups: DetailViewGroup[];
  renderItem: RenderItem;
  formatBRL: FormatBRL;
}> = ({ monthKey, groups, renderItem, formatBRL }) => {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const entries = flattenDated(groups);
  const undated = entries.filter((e) => !e.date);

  const [y, m] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const leadingBlanks = new Date(y, m - 1, 1).getDay();
  const byDay = new Map<number, DatedEntry[]>();
  entries
    .filter((e) => e.date && e.date.startsWith(monthKey))
    .forEach((e) => {
      const day = Number(e.date!.slice(8, 10));
      byDay.set(day, [...(byDay.get(day) || []), e]);
    });

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedEntries = selectedDay
    ? selectedDay === 'SEM_DATA'
      ? undated
      : byDay.get(Number(selectedDay.slice(8, 10))) || []
    : [];

  if (entries.length === 0) return <EmptyState />;

  return (
    <div>
      <div className="cal-grid" role="grid" aria-label="Calendário da competência">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="cal-weekday">
            {w}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`b${idx}`} className="cal-cell cal-blank" />;
          const iso = `${monthKey}-${String(day).padStart(2, '0')}`;
          const dayEntries = byDay.get(day) || [];
          const total = sumItems(dayEntries.map((e) => e.item));
          const symbols = Array.from(new Set(dayEntries.map((e) => e.symbol)));
          const allRealized = dayEntries.length > 0 && dayEntries.every((e) => e.item.status === 'REALIZADA');
          const isSelected = selectedDay === iso;
          return (
            <button
              key={iso}
              type="button"
              className={`cal-cell ${dayEntries.length > 0 ? 'has-entries' : ''} ${allRealized ? 'is-realized' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => dayEntries.length > 0 && setSelectedDay(isSelected ? null : iso)}
              disabled={dayEntries.length === 0}
              title={dayEntries.length > 0 ? `${longDate(iso)} • ${formatBRL(total)} (${dayEntries.length} lançamentos)` : longDate(iso)}
            >
              <span className="cal-day">{day}</span>
              {dayEntries.length > 0 && (
                <>
                  <span className="cal-symbols">
                    {symbols.slice(0, 3).join('')}
                    {symbols.length > 3 ? `+${symbols.length - 3}` : ''}
                  </span>
                  <span className="cal-value">{compactValue(total)}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {undated.length > 0 && (
        <button
          type="button"
          className={`cal-undated ${selectedDay === 'SEM_DATA' ? 'selected' : ''}`}
          onClick={() => setSelectedDay(selectedDay === 'SEM_DATA' ? null : 'SEM_DATA')}
        >
          📋 Sem data definida (resumos por mapeamento): <strong>{formatBRL(sumItems(undated.map((e) => e.item)))}</strong>
        </button>
      )}

      {selectedDay && selectedEntries.length > 0 && (
        <div className="sticky-date-group-block mt-3">
          <div className="sticky-date-group-header">
            <span className="sticky-date-title">
              {selectedDay === 'SEM_DATA' ? '📋 Sem data definida' : `📅 ${longDate(selectedDay)}`}
            </span>
            <div className="sticky-date-subtotal">
              <span className="subtotal-prefix">Subtotal:</span>
              <span className="subtotal-val">{formatBRL(sumItems(selectedEntries.map((e) => e.item)))}</span>
            </div>
          </div>
          <div className="sticky-date-items-list">{selectedEntries.map((e) => renderItem(e.item))}</div>
        </div>
      )}

      {!selectedDay && (
        <p className="text-[11px] text-muted mt-2">Toque em um dia para ver os lançamentos.</p>
      )}
    </div>
  );
};
