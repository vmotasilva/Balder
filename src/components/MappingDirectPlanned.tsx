import React, { useState } from 'react';
import { Edit2, Plus, Save, Trash2, X } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { DecimalInput } from './DecimalInput';
import { WEEKDAY_OPTIONS, formatItemScheduleBadge } from '../utils/natureScheduling';
import type { FixedExpenseMapping, MappingItem } from '../types';

type Recurrence = 'SEMANAL' | 'QUINZENAL' | 'MENSAL';
type Weekday = (typeof WEEKDAY_OPTIONS)[number]['value'];

// Quantas vezes o valor se repete no mês (o previsto em si vem das datas do mês)
const MULTIPLIER: Record<Recurrence, number> = { SEMANAL: 4, QUINZENAL: 2, MENSAL: 1 };
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface MappingDirectPlannedProps {
  natureId: string;
  mapping: FixedExpenseMapping;
}

/**
 * Previsto direto do mapeamento: valor, periodicidade e dia, sem lista de itens (ex.: Dentista).
 * É guardado como um item interno do mapeamento, então projeção, pagamentos e acompanhamento por período
 * funcionam como já funcionam para os itens, sem tratamento à parte.
 */
export const MappingDirectPlanned: React.FC<MappingDirectPlannedProps> = ({ natureId, mapping }) => {
  const { addItemToMapping, updateMappingItem, deleteMappingItem } = useFinancial();
  const base: MappingItem | undefined = mapping.items.find((it) => it.isMappingBase);
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(0);
  const [rec, setRec] = useState<Recurrence>('MENSAL');
  const [dayOfWeek, setDayOfWeek] = useState<Weekday>('SABADO');
  const [dayOfFortnight, setDayOfFortnight] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(10);

  const start = () => {
    setPrice(base?.price || 0);
    setRec(base?.recurrenceType === 'SEMANAL' || base?.recurrenceType === 'QUINZENAL' ? base.recurrenceType : 'MENSAL');
    setDayOfWeek(base?.dayOfWeek || 'SABADO');
    setDayOfFortnight(base?.dayOfFortnight || 1);
    setDayOfMonth(base?.dayOfMonth || 10);
    setEditing(true);
  };

  const save = () => {
    if (price <= 0) return;
    const schedule = {
      recurrenceType: rec,
      multiplierWeeks: MULTIPLIER[rec],
      dayOfWeek: rec === 'SEMANAL' ? dayOfWeek : undefined,
      dayOfFortnight: rec === 'QUINZENAL' ? dayOfFortnight : undefined,
      dayOfMonth: rec === 'MENSAL' ? dayOfMonth : undefined,
    };
    if (base) {
      updateMappingItem(natureId, mapping.id, base.id, { description: mapping.name, price, ...schedule });
    } else {
      addItemToMapping(natureId, mapping.id, { isMappingBase: true, description: mapping.name, quantity: 1, price, ...schedule });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="mapping-direct is-editing">
        <div className="mapping-direct-fields">
          <label>
            <span>Valor previsto</span>
            <DecimalInput className="form-input form-input-sm" value={price} onValueChange={setPrice} emptyWhenZero aria-label="Valor previsto" autoFocus />
          </label>
          <label>
            <span>Periodicidade</span>
            <select className="form-input form-input-sm" value={rec} onChange={(e) => setRec(e.target.value as Recurrence)} aria-label="Periodicidade">
              <option value="SEMANAL">🗓️ Semanal</option>
              <option value="QUINZENAL">🌓 Quinzenal</option>
              <option value="MENSAL">📅 Mensal</option>
            </select>
          </label>
          <label>
            <span>{rec === 'SEMANAL' ? 'Dia da semana' : rec === 'QUINZENAL' ? 'Dia da quinzena' : 'Dia do mês'}</span>
            {rec === 'SEMANAL' ? (
              <select className="form-input form-input-sm" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value as Weekday)} aria-label="Dia da semana">
                {WEEKDAY_OPTIONS.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                className="form-input form-input-sm"
                min={1}
                max={rec === 'QUINZENAL' ? 15 : 31}
                value={rec === 'QUINZENAL' ? dayOfFortnight : dayOfMonth}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(rec === 'QUINZENAL' ? 15 : 31, Number(e.target.value) || 1));
                  if (rec === 'QUINZENAL') setDayOfFortnight(n);
                  else setDayOfMonth(n);
                }}
                aria-label={rec === 'QUINZENAL' ? 'Dia da quinzena' : 'Dia do mês'}
              />
            )}
          </label>
        </div>
        <div className="mapping-direct-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
            <X size={14} /> <span>Cancelar</span>
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={price <= 0}>
            <Save size={14} /> <span>Salvar previsto</span>
          </button>
        </div>
      </div>
    );
  }

  if (!base) {
    return (
      <div className="mapping-direct">
        <button type="button" className="btn btn-outline btn-sm" onClick={start} title="Definir o valor previsto sem lançar itens">
          <Plus size={14} /> <span>Definir previsto direto</span>
        </button>
        <span className="mapping-direct-hint">Sem lista de itens: só valor, periodicidade e dia.</span>
      </div>
    );
  }

  const badge = formatItemScheduleBadge(base);
  return (
    <div className="mapping-direct">
      <div className="mapping-direct-summary">
        <span className="mapping-direct-label">Previsto direto</span>
        <strong className="text-glow-cyan font-mono">{brl(base.price)}</strong>
        <span className={`badge ${badge.badgeClass} text-[11px]`} title={badge.detail}>
          {badge.icon} {badge.label}
        </span>
        <span className="mapping-direct-hint">{brl(base.totalValue)} no mês</span>
      </div>
      <div className="mapping-direct-actions">
        <button type="button" className="btn btn-ghost btn-xs text-cyan" title="Editar o previsto direto" onClick={start}>
          <Edit2 size={13} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs text-rose"
          title="Remover o previsto direto"
          onClick={() => deleteMappingItem(natureId, mapping.id, base.id)}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};
