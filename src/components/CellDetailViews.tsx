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
const DrillRow: React.FC<{ symbol?: string; title: string; count: number; total: number; onClick: () => void; formatBRL: FormatBRL }> = ({
  symbol,
  title,
  count,
  total,
  onClick,
  formatBRL,
}) => (
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
      <span className="detail-item-amount font-mono">{formatBRL(total)}</span>
      <ChevronRight size={16} className="text-muted" />
    </div>
  </button>
);

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
            {visible.map((g) => (
              <DrillRow
                key={g.id}
                symbol={g.symbol}
                title={g.title}
                count={g.items.length}
                total={sumItems(g.items)}
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
            {mappings.map((m) => {
              const isSummary = m.items.length === 1 && m.items[0].isMappingSummary;
              return (
                <DrillRow
                  key={m.key}
                  title={m.label}
                  count={isSummary ? m.items[0].summaryItemCount || 1 : m.items.length}
                  total={sumItems(m.items)}
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
        Subtotal do mapeamento: <strong>{formatBRL(sumItems(mapping.items))}</strong>
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

// ─── Por semana ──────────────────────────────────────────────────────────────

export const WeekGroupedView: React.FC<{
  monthKey: string;
  groups: DetailViewGroup[];
  renderItem: RenderItem;
  formatBRL: FormatBRL;
}> = ({ monthKey, groups, renderItem, formatBRL }) => {
  const entries = flattenDated(groups);
  const undated = entries.filter((e) => !e.date);

  // Semanas do mês (domingo a sábado), recortadas aos dias da competência
  const [y, m] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const weeks: { start: number; end: number }[] = [];
  let start = 1;
  while (start <= daysInMonth) {
    const end = Math.min(daysInMonth, start + (6 - new Date(y, m - 1, start).getDay()));
    weeks.push({ start, end });
    start = end + 1;
  }

  const dated = entries.filter((e) => e.date && e.date.startsWith(monthKey));
  if (entries.length === 0) return <EmptyState />;

  return (
    <div>
      <UndatedBlock entries={undated} renderItem={renderItem} formatBRL={formatBRL} />
      {weeks.map((w, idx) => {
        const inWeek = dated
          .filter((e) => {
            const day = Number(e.date!.slice(8, 10));
            return day >= w.start && day <= w.end;
          })
          .sort((a, b) => a.date!.localeCompare(b.date!));
        if (inWeek.length === 0) return null;
        const pad = (d: number) => `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
        return (
          <div key={w.start} className="sticky-date-group-block">
            <div className="sticky-date-group-header">
              <span className="sticky-date-title">
                🗓️ Semana {idx + 1} · {pad(w.start)} – {pad(w.end)}
              </span>
              <div className="sticky-date-subtotal">
                <span className="subtotal-prefix">Subtotal:</span>
                <span className="subtotal-val">{formatBRL(sumItems(inWeek.map((e) => e.item)))}</span>
              </div>
            </div>
            <div className="sticky-date-items-list">
              {inWeek.map((e) => (
                <div key={`${e.date}_${e.item.id}`} className="week-entry">
                  <span className="week-entry-day" title={longDate(e.date!)}>
                    {WEEKDAYS_SHORT[parseIso(e.date!).getDay()]} {e.date!.slice(8, 10)}
                  </span>
                  <div className="week-entry-row">{renderItem(e.item)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
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
