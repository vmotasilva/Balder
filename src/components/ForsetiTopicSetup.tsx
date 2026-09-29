import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import { DecimalInput } from './DecimalInput';
import { useFinancial, buildSuggestedMappingsForNature } from '../context/FinancialContext';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/supabaseService';
import { POPULAR_BANKS, getBankBranding } from '../utils/bankBranding';
import { normalizeBankKey } from '../utils/cardUtils';
import {
  BILL_GROUPS,
  COMMON_BILLS,
  SUGGESTED_NATURES,
  brDate,
  clampDay,
  formatBRL,
  isoOf,
  nextDateForDay,
  suggestedRoutinesFor,
  type BillGroupKey,
  type SetupTopic,
} from '../utils/setupCatalog';
import type { TrackingPeriod } from '../utils/periodSpending';
import type { ExpenseNature, FixedExpenseMapping, MappingItem, Movement } from '../types';


const TOPICS: { id: SetupTopic; label: string; hint: string; why: string }[] = [
  { id: 'INICIO', label: 'Ponto de partida', hint: 'Bancos, saldo de hoje e a data em que começo a acompanhar.', why: 'é a base de todas as projeções de saldo' },
  { id: 'ENTRADAS', label: 'Entradas', hint: 'Salário e outros valores que entram todo mês.', why: 'assim sei quanto você tem para gastar' },
  { id: 'CARTOES', label: 'Cartões de crédito', hint: 'Vencimento e valor da próxima fatura.', why: 'fatura esquecida é a maior causa de susto no mês' },
  { id: 'CONTAS', label: 'Contas do mês', hint: 'Aluguel, luz, internet e outras contas fixas.', why: 'são os compromissos que não podem atrasar' },
  { id: 'NATUREZAS', label: 'Naturezas', hint: 'Os grupos onde seus gastos se juntam, como Alimentação.', why: 'é como separo seus gastos para te mostrar onde o dinheiro vai' },
  { id: 'MAPEAMENTOS', label: 'Mapeamentos das naturezas', hint: 'O que você compra em cada natureza, quanto e quando.', why: 'com eles eu sei o teto real de cada natureza' },
  { id: 'ACOMPANHAMENTO', label: 'Acompanhamento', hint: 'De quanto em quanto tempo te mostro os gastos.', why: 'para os resumos virem no seu ritmo' },
];

export const Bubble: React.FC<{ from: 'forseti' | 'user'; children: React.ReactNode }> = ({ from, children }) => (
  <div className={`guided-bubble is-${from}`}>
    {from === 'forseti' && (
      <span className="guided-avatar" aria-hidden="true">
        <Sparkles size={14} />
      </span>
    )}
    <div className="guided-bubble-body">{children}</div>
  </div>
);

/** Pergunta da Forseti com o painel de resposta logo abaixo. */
const Ask: React.FC<{
  question: React.ReactNode;
  scrollKey?: string;
  hint?: string;
  onBack?: () => void;
  backLabel?: string;
  children: React.ReactNode;
}> = ({
  question,
  scrollKey,
  hint,
  onBack,
  backLabel = 'Voltar à pergunta anterior',
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  // A cada pergunta nova, traz o painel de resposta para a tela
  const key = typeof question === 'string' ? question : scrollKey;
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [key]);
  return (
    <>
      <Bubble from="forseti">{question}</Bubble>
      <div className="guided-panel" ref={panelRef}>
        {hint && <p className="guided-hint">{hint}</p>}
        {children}
        {onBack && (
          <button type="button" className="guided-back" onClick={onBack}>
            <ArrowLeft size={12} /> {backLabel}
          </button>
        )}
      </div>
    </>
  );
};

const Choice: React.FC<{ title: string; hint?: string; active?: boolean; badge?: string; onClick: () => void }> = ({ title, hint, active, badge, onClick }) => (
  <button type="button" className={`guided-choice ${active ? 'is-active' : ''}`} onClick={onClick}>
    <strong>
      {title}
      {badge && <span className="guided-choice-badge">{badge}</span>}
    </strong>
    {hint && <span>{hint}</span>}
  </button>
);

const Chip: React.FC<{ label: string; active: boolean; disabled?: boolean; title?: string; onClick: () => void }> = ({ label, active, disabled, title, onClick }) => (
  <button type="button" className={`guided-chip ${active ? 'is-active' : ''}`} disabled={disabled} title={title} onClick={onClick}>
    {active && <Check size={12} />} {label}
  </button>
);

/** Campo de texto + botão "Adicionar" usado para itens que não estão entre as sugestões. */
const AddOther: React.FC<{ placeholder: string; onAdd: (value: string) => void }> = ({ placeholder, onAdd }) => {
  const [value, setValue] = useState('');
  const submit = () => {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue('');
  };
  return (
    <div className="guided-inline">
      <input
        className="form-input form-input-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button type="button" className="btn btn-outline btn-sm" disabled={!value.trim()} onClick={submit}>
        <Plus size={14} /> Adicionar
      </button>
    </div>
  );
};

const DayInput: React.FC<{ label?: string; value: number; max?: number; onChange: (day: number) => void }> = ({ label = 'dia', value, max = 31, onChange }) => (
  <label className="guided-day">
    <span>{label}</span>
    <input type="number" min={1} max={max} className="form-input form-input-sm" value={value} onChange={(e) => onChange(clampDay(Number(e.target.value), max))} />
  </label>
);

interface TopicProps {
  log: (question: string, answer: string) => void;
  unlog: () => void;
  onDone: (summary: string) => void;
  onCancel: () => void;
  onSwitch: (topic: SetupTopic) => void;
  setHomeScreen: (screen: 'INICIO' | 'PAINEL') => void;
}

/** Sequência de perguntas de um assunto: cada resposta fica no histórico e dá para voltar uma a uma. */
function useSteps<S extends string>(first: S, p: TopicProps) {
  const [stack, setStack] = useState<S[]>([first]);
  const step = stack[stack.length - 1];
  const isFirst = stack.length <= 1;
  return {
    step,
    go: (question: string, answer: string, to: S) => {
      p.log(question, answer);
      setStack((s) => [...s, to]);
    },
    finish: (question: string, answer: string, summary: string) => {
      p.log(question, answer);
      p.onDone(summary);
    },
    back: () => {
      if (isFirst) return p.onCancel();
      p.unlog();
      setStack((s) => s.slice(0, -1));
    },
    backLabel: isFirst ? 'Escolher outro assunto' : 'Voltar à pergunta anterior',
  };
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// Ponto de partida
// ─────────────────────────────────────────────────────────────────────────────
const InicioTopic: React.FC<TopicProps> = (p) => {
  const { activeCheckpoint, banks, accounts, addCheckpoint, addBank, addAccount, updateAccount } = useFinancial();
  const s = useSteps<'EXISTING' | 'BANKS' | 'BALANCES' | 'START' | 'DATE'>(activeCheckpoint ? 'EXISTING' : 'BANKS', p);
  const today = new Date();
  const todayIso = isoOf(today);
  const [keep, setKeep] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => {
    const known = [...banks.map((b) => b.name), ...accounts.map((a) => a.bankName || a.name)];
    return known.filter((n, i) => known.findIndex((x) => sameName(x, n)) === i);
  });
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [customDate, setCustomDate] = useState(todayIso);
  const total = Object.values(balances).reduce((acc, v) => acc + (v || 0), 0);

  const toggle = (name: string) => setSelected((prev) => (prev.some((b) => sameName(b, name)) ? prev.filter((b) => !sameName(b, name)) : [...prev, name]));

  const save = (startDate: string | null) => {
    if (startDate) {
      addCheckpoint({
        label: `Início do acompanhamento (${brDate(startDate)})`,
        startDate,
        initialBalance: total,
        creditCardDebt: 0,
        initialNetWorth: total,
        notes: 'Ponto de partida definido em conversa com a Forseti',
      });
    }
    selected.forEach((name) => {
      const brand = getBankBranding(name);
      if (!banks.some((b) => sameName(b.name, name))) {
        addBank({ name, color: brand.primaryColor, icon: brand.iconText || '🏦', status: 'MANUAL', syncedAt: 'Ativo no Balder' });
      }
      const account = accounts.find((a) => sameName(a.bankName || a.name, name));
      const balance = balances[name] || 0;
      if (!account) {
        addAccount({ name: `Conta ${name}`, bankName: name, balance, type: 'CORRENTE', color: brand.primaryColor, icon: '🏦' });
      } else if (startDate && balance > 0) {
        updateAccount(account.id, { balance });
      }
    });
    const where = selected.length > 0 ? ` em ${selected.join(', ')}` : '';
    return startDate
      ? `Ponto de partida criado em ${brDate(startDate)}, com ${formatBRL(total)}${where}.`
      : `Bancos revisados: ${selected.join(', ') || 'só dinheiro'}.`;
  };

  switch (s.step) {
    case 'EXISTING': {
      const q = `Você já tem um ponto de partida desde ${brDate(activeCheckpoint!.startDate)}, com ${formatBRL(activeCheckpoint!.initialBalance)} em caixa. O que prefere fazer?`;
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-choices">
            <Choice title="Manter e revisar os bancos" hint="O saldo e a data continuam como estão." onClick={() => { setKeep(true); s.go(q, 'Manter e revisar os bancos', 'BANKS'); }} />
            <Choice title="Começar um novo ponto de partida" hint="Informo o saldo de hoje e a data de início." onClick={() => { setKeep(false); s.go(q, 'Começar um novo ponto de partida', 'BANKS'); }} />
          </div>
        </Ask>
      );
    }
    case 'BANKS': {
      const q = 'Em quais bancos você tem conta?';
      const next = (answer: string) => (keep ? s.finish(q, answer, save(null)) : s.go(q, answer, 'BALANCES'));
      return (
        <Ask question={q} hint="Toque em todos que você usa. Dá para adicionar outro no campo abaixo." onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-chips">
            {[...POPULAR_BANKS, ...selected.filter((b) => !(POPULAR_BANKS as readonly string[]).some((x) => sameName(x, b)))].map((b) => (
              <Chip key={b} label={b} active={selected.some((x) => sameName(x, b))} onClick={() => toggle(b)} />
            ))}
          </div>
          <AddOther placeholder="Outro banco" onAdd={(name) => !selected.some((b) => sameName(b, name)) && setSelected((prev) => [...prev, name])} />
          <div className="guided-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setSelected([]); next('Só uso dinheiro'); }}>
              Só uso dinheiro
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={selected.length === 0} onClick={() => next(selected.join(', '))}>
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
    case 'BALANCES': {
      const q = selected.length > 1 ? 'Quanto você tem hoje em cada um?' : 'Quanto você tem hoje?';
      const rows = selected.length > 0 ? selected : ['Dinheiro'];
      return (
        <Ask question={q} hint="Pode ser um valor aproximado. Dá para ajustar depois." onBack={s.back} backLabel={s.backLabel}>
          {rows.map((name) => (
            <div key={name} className="guided-row">
              <span className="guided-row-name">{name}</span>
              <DecimalInput className="form-input form-input-sm" money value={balances[name] || 0} emptyWhenZero onValueChange={(v) => setBalances((prev) => ({ ...prev, [name]: v }))} aria-label={`Saldo em ${name}`} placeholder="R$" />
            </div>
          ))}
          {rows.length > 1 && <p className="guided-hint">Total: <strong>{formatBRL(total)}</strong></p>}
          <div className="guided-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setBalances({}); s.go(q, 'Prefiro informar depois', 'START'); }}>
              Informar depois
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => s.go(q, formatBRL(total), 'START')}>
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
    case 'START': {
      const q = 'A partir de quando você quer que eu acompanhe o seu dinheiro?';
      const firstDay = `${todayIso.slice(0, 7)}-01`;
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-choices">
            <Choice title={`Hoje (${brDate(todayIso)})`} hint="O saldo que você informou é o de hoje." onClick={() => s.finish(q, 'A partir de hoje', save(todayIso))} />
            <Choice title="Desde o dia 1º deste mês" hint="Bom para acompanhar o mês inteiro." onClick={() => s.finish(q, 'Desde o dia 1º', save(firstDay))} />
            <Choice title="Outra data" hint="Escolho a data no calendário." onClick={() => s.go(q, 'Outra data', 'DATE')} />
          </div>
        </Ask>
      );
    }
    case 'DATE': {
      const q = 'Qual data?';
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <input type="date" className="form-input form-input-sm guided-date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
          <div className="guided-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={!customDate} onClick={() => s.finish(q, brDate(customDate), save(customDate))}>
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Entradas
// ─────────────────────────────────────────────────────────────────────────────
const INCOME_KINDS = ['Salário', 'Vale-alimentação', 'Pró-labore', 'Aposentadoria', 'Pensão', 'Aluguel recebido', 'Freelas'];

const EntradasTopic: React.FC<TopicProps> = (p) => {
  const { accounts, banks, addMultipleMovements } = useFinancial();
  const s = useSteps<'KINDS' | 'VALUES' | 'ACCOUNT' | 'REPEAT'>('KINDS', p);
  const [rows, setRows] = useState<{ name: string; amount: number; day: number }[]>([]);
  const places = [...accounts.map((a) => a.bankName || a.name), ...banks.map((b) => b.name)].filter((n, i, arr) => arr.findIndex((x) => sameName(x, n)) === i);
  const [place, setPlace] = useState(places[0] || '');
  const total = rows.reduce((acc, r) => acc + (r.amount || 0), 0);

  const toggle = (name: string) =>
    setRows((prev) => (prev.some((r) => r.name === name) ? prev.filter((r) => r.name !== name) : [...prev, { name, amount: 0, day: name === 'Salário' ? 5 : 10 }]));
  const update = (idx: number, changes: Partial<{ amount: number; day: number }>) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...changes } : r)));

  const save = (months: number) => {
    const today = new Date();
    const stamp = Date.now();
    const list: Omit<Movement, 'id'>[] = [];
    rows
      .filter((r) => r.amount > 0)
      .forEach((r, idx) => {
        for (let n = 0; n < months; n++) {
          list.push({
            title: r.name,
            type: 'RECEBER',
            amount: r.amount,
            dueDate: nextDateForDay(r.day, today, n),
            bank: place,
            status: 'PREVISTA',
            category: r.name === 'Salário' ? 'Salário' : 'Receita',
            notes: months > 1 ? `Repetição mensal ${n + 1}/${months}` : undefined,
            installmentGroupId: months > 1 ? `rec_${stamp}_${idx}` : undefined,
          });
        }
      });
    if (list.length > 0) addMultipleMovements(list);
    const count = rows.filter((r) => r.amount > 0).length;
    return `${count} entrada${count > 1 ? 's' : ''} cadastrada${count > 1 ? 's' : ''}: ${formatBRL(total)} por mês.`;
  };

  switch (s.step) {
    case 'KINDS': {
      const q = 'Que dinheiro entra para você todo mês?';
      return (
        <Ask question={q} hint="Marque tudo o que se repete. Recebimentos avulsos você me conta quando acontecerem." onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-chips">
            {[...INCOME_KINDS, ...rows.map((r) => r.name).filter((n) => !INCOME_KINDS.includes(n))].map((k) => (
              <Chip key={k} label={k} active={rows.some((r) => r.name === k)} onClick={() => toggle(k)} />
            ))}
          </div>
          <AddOther placeholder="Outra entrada" onAdd={(name) => !rows.some((r) => sameName(r.name, name)) && toggle(name)} />
          <div className="guided-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => s.finish(q, 'Não tenho entrada fixa', 'Sem entradas fixas por enquanto: é só me contar cada recebimento quando ele acontecer.')}>
              Não tenho entrada fixa
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={rows.length === 0} onClick={() => s.go(q, rows.map((r) => r.name).join(', '), 'VALUES')}>
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
    case 'VALUES': {
      const q = rows.length > 1 ? 'Quanto é cada uma e em que dia costuma cair?' : `Quanto é ${rows[0]?.name.toLowerCase()} e em que dia costuma cair?`;
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          {rows.map((r, idx) => (
            <div key={r.name} className="guided-row">
              <span className="guided-row-name">{r.name}</span>
              <DecimalInput className="form-input form-input-sm" money value={r.amount} emptyWhenZero onValueChange={(v) => update(idx, { amount: v })} placeholder="Valor" aria-label={`Valor de ${r.name}`} />
              <DayInput value={r.day} onChange={(day) => update(idx, { day })} />
            </div>
          ))}
          <div className="guided-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={total <= 0}
              onClick={() => s.go(q, rows.filter((r) => r.amount > 0).map((r) => `${r.name}: ${formatBRL(r.amount)} no dia ${r.day}`).join(' · '), places.length > 1 ? 'ACCOUNT' : 'REPEAT')}
            >
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
    case 'ACCOUNT': {
      const q = 'Em qual conta esse dinheiro cai?';
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-chips">
            {places.map((b) => (
              <Chip key={b} label={b} active={place === b} onClick={() => { setPlace(b); s.go(q, b, 'REPEAT'); }} />
            ))}
          </div>
        </Ask>
      );
    }
    case 'REPEAT': {
      const q = 'Por quanto tempo devo contar com essas entradas?';
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-choices">
            <Choice title="Pelos próximos 12 meses" hint="Entram nas projeções do ano inteiro." onClick={() => s.finish(q, 'Pelos próximos 12 meses', save(12))} />
            <Choice title="Pelos próximos 6 meses" onClick={() => s.finish(q, 'Pelos próximos 6 meses', save(6))} />
            <Choice title="Só este mês" hint="Depois eu te pergunto de novo." onClick={() => s.finish(q, 'Só este mês', save(1))} />
          </div>
        </Ask>
      );
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Cartões de crédito
// ─────────────────────────────────────────────────────────────────────────────
const CartoesTopic: React.FC<TopicProps> = (p) => {
  const { cards, banks, accounts, movements, addCard, updateCard, addMovement, updateMovement } = useFinancial();
  const s = useSteps<'USES' | 'WHICH' | 'DETAILS'>('USES', p);
  const [rows, setRows] = useState<{ name: string; dueDay: number; amount: number }[]>([]);
  const known = [...banks.map((b) => b.name), ...accounts.map((a) => a.bankName || a.name), ...POPULAR_BANKS].filter(
    (n, i, arr) => arr.findIndex((x) => sameName(x, n)) === i
  );
  const total = rows.reduce((acc, r) => acc + (r.amount || 0), 0);

  const toggle = (name: string) =>
    setRows((prev) => (prev.some((r) => sameName(r.name, name)) ? prev.filter((r) => !sameName(r.name, name)) : [...prev, { name, dueDay: 10, amount: 0 }]));
  const update = (idx: number, changes: Partial<{ dueDay: number; amount: number }>) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...changes } : r)));

  const save = () => {
    const today = new Date();
    rows.forEach((r) => {
      const key = normalizeBankKey(r.name);
      const closingDay = Math.max(1, r.dueDay - 7);
      const existing = cards.find((c) => normalizeBankKey(c.bank || c.name || '') === key);
      if (existing) updateCard(existing.id, { dueDay: r.dueDay, closingDay });
      else
        addCard({
          name: `Cartão ${r.name}`,
          bank: r.name,
          brand: 'OUTRA',
          limitTotal: Math.max(1000, Math.round(r.amount * 2)),
          closingDay,
          dueDay: r.dueDay,
          color: getBankBranding(r.name).primaryColor,
        });
      if (r.amount > 0) {
        const dueDate = nextDateForDay(r.dueDay, today);
        const invoice = movements.find(
          (m) => m.type === 'CARTAO' && m.status === 'PREVISTA' && normalizeBankKey(m.bank || '') === key && m.dueDate.startsWith(dueDate.slice(0, 7))
        );
        if (invoice) updateMovement(invoice.id, { amount: r.amount, dueDate });
        else addMovement({ title: `Fatura ${r.name}`, amount: r.amount, dueDate, type: 'CARTAO', status: 'PREVISTA', category: 'Fatura de Cartão', bank: r.name });
      }
    });
    return `${rows.length} cartã${rows.length > 1 ? 'os cadastrados' : 'o cadastrado'}${total > 0 ? `, com ${formatBRL(total)} em faturas a vencer` : ''}.`;
  };

  switch (s.step) {
    case 'USES': {
      const q = cards.length > 0 ? `Você já tem ${cards.map((c) => c.name).join(', ')}. Quer cadastrar ou atualizar algum cartão?` : 'Você usa cartão de crédito?';
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-actions is-start">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => s.finish(q, 'Não', cards.length > 0 ? 'Cartões mantidos como estão.' : 'Sem cartão de crédito: acompanho só as contas e o dinheiro.')}>
              Não
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => s.go(q, 'Sim', 'WHICH')}>
              Sim
            </button>
          </div>
        </Ask>
      );
    }
    case 'WHICH': {
      const q = 'De quais bancos são os seus cartões?';
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-chips">
            {[...known, ...rows.map((r) => r.name).filter((n) => !known.some((k) => sameName(k, n)))].map((b) => (
              <Chip key={b} label={b} active={rows.some((r) => sameName(r.name, b))} onClick={() => toggle(b)} />
            ))}
          </div>
          <AddOther placeholder="Outro cartão" onAdd={(name) => !rows.some((r) => sameName(r.name, name)) && toggle(name)} />
          <div className="guided-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={rows.length === 0} onClick={() => s.go(q, rows.map((r) => r.name).join(', '), 'DETAILS')}>
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
    case 'DETAILS': {
      const q = rows.length > 1 ? 'Em que dia vence cada um e quanto está a próxima fatura?' : `Em que dia vence o ${rows[0]?.name} e quanto está a próxima fatura?`;
      return (
        <Ask question={q} hint="As compras novas você me conta depois, ou manda a foto da fatura." onBack={s.back} backLabel={s.backLabel}>
          {rows.map((r, idx) => (
            <div key={r.name} className="guided-row">
              <span className="guided-row-name">{r.name}</span>
              <DecimalInput className="form-input form-input-sm" money value={r.amount} emptyWhenZero onValueChange={(v) => update(idx, { amount: v })} placeholder="Próxima fatura" aria-label={`Próxima fatura ${r.name}`} />
              <DayInput label="vence dia" value={r.dueDay} onChange={(dueDay) => update(idx, { dueDay })} />
            </div>
          ))}
          <div className="guided-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => s.finish(q, rows.map((r) => `${r.name}: ${formatBRL(r.amount)}, dia ${r.dueDay}`).join(' · '), save())}
            >
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Contas do mês
// ─────────────────────────────────────────────────────────────────────────────
const PAY_OPTIONS: { id: NonNullable<MappingItem['paymentMethod']>; label: string }[] = [
  { id: 'BOLETO', label: 'Boleto' },
  { id: 'CONTA', label: 'Débito em conta' },
  { id: 'PIX', label: 'Pix' },
  { id: 'CARTAO', label: 'Cartão de crédito' },
];

const ContasTopic: React.FC<TopicProps> = (p) => {
  const { natures, activeCheckpoint, addNature, updateNature } = useFinancial();
  const s = useSteps<'PICK' | 'VALUES' | 'PAY'>('PICK', p);
  const [bills, setBills] = useState<{ key: string; name: string; amount: number; day: number }[]>([]);
  const total = bills.reduce((acc, b) => acc + (b.amount || 0), 0);

  const toggle = (key: string, name: string) =>
    setBills((prev) => (prev.some((b) => b.key === key) ? prev.filter((b) => b.key !== key) : [...prev, { key, name, amount: 0, day: 10 }]));
  const update = (key: string, changes: Partial<{ amount: number; day: number }>) => setBills((prev) => prev.map((b) => (b.key === key ? { ...b, ...changes } : b)));

  const save = (payment: NonNullable<MappingItem['paymentMethod']>) => {
    const stamp = Date.now();
    const monthKey = isoOf(new Date()).slice(0, 7);
    // Contas que venceram antes do início do acompanhamento neste mês ficam de fora da competência
    const startDay = activeCheckpoint?.startDate.startsWith(monthKey) ? Number(activeCheckpoint.startDate.slice(8, 10)) : 1;
    const byGroup = new Map<BillGroupKey, typeof bills>();
    bills
      .filter((b) => b.amount > 0)
      .forEach((b) => {
        const group = COMMON_BILLS.find((c) => c.key === b.key)?.group || 'OUTRAS';
        byGroup.set(group, [...(byGroup.get(group) || []), b]);
      });

    byGroup.forEach((rows, groupKey) => {
      const group = BILL_GROUPS[groupKey];
      const items: MappingItem[] = rows.map((b, i) => ({
        id: `item_${stamp}_${groupKey}_${i}`,
        description: b.name,
        quantity: 1,
        price: b.amount,
        unit: 'un',
        multiplierWeeks: 1,
        totalValue: b.amount,
        realizedValue: 0,
        isFulfilled: false,
        paymentMethod: payment,
        recurrenceType: 'MENSAL',
        dayOfMonth: b.day,
        ...(b.day < startDay ? { monthStates: { [monthKey]: { skipped: true, skipReason: 'Antes do início do acompanhamento' } } } : {}),
      }));
      const existing = natures.find((n) => sameName(n.name, group.name));
      const mapping: FixedExpenseMapping = {
        id: `map_${stamp}_${groupKey}`,
        name: 'Contas do mês',
        natureId: existing?.id || '',
        icon: group.icon,
        applicableMonths: [],
        frequency: 'MENSAL',
        items,
        keywords: group.keywords,
      };
      if (!existing) {
        addNature({ name: group.name, icon: group.icon, color: group.color, type: group.type, keywords: group.keywords, mappings: [mapping] });
        return;
      }
      const current = existing.mappings.find((m) => m.name === 'Contas do mês');
      updateNature(existing.id, {
        mappings: current
          ? existing.mappings.map((m) => (m.id === current.id ? { ...m, items: [...m.items, ...items] } : m))
          : [...existing.mappings, mapping],
      });
    });
    const count = bills.filter((b) => b.amount > 0).length;
    return `${count} conta${count > 1 ? 's' : ''} do mês organizada${count > 1 ? 's' : ''} em ${byGroup.size} natureza${byGroup.size > 1 ? 's' : ''}: ${formatBRL(total)} por mês.`;
  };

  switch (s.step) {
    case 'PICK': {
      const q = 'Quais contas você paga todo mês?';
      return (
        <Ask question={q} hint="Toque nas que você tem." onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-chips">
            {COMMON_BILLS.map((b) => (
              <Chip key={b.key} label={b.name} active={bills.some((x) => x.key === b.key)} onClick={() => toggle(b.key, b.name)} />
            ))}
            {bills
              .filter((b) => b.key.startsWith('custom_'))
              .map((b) => (
                <Chip key={b.key} label={b.name} active onClick={() => toggle(b.key, b.name)} />
              ))}
          </div>
          <AddOther placeholder="Outra conta (ex.: seguro do carro)" onAdd={(name) => toggle(`custom_${Date.now()}`, name)} />
          <div className="guided-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => s.finish(q, 'Nenhuma por enquanto', 'Sem contas fixas por enquanto.')}>
              Nenhuma por enquanto
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={bills.length === 0} onClick={() => s.go(q, bills.map((b) => b.name).join(', '), 'VALUES')}>
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
    case 'VALUES': {
      const q = 'Quanto é cada uma e em que dia vence?';
      return (
        <Ask question={q} hint="Se o valor muda todo mês, coloque a média." onBack={s.back} backLabel={s.backLabel}>
          {bills.map((b) => (
            <div key={b.key} className="guided-row">
              <span className="guided-row-name">{b.name}</span>
              <DecimalInput className="form-input form-input-sm" money value={b.amount} emptyWhenZero onValueChange={(v) => update(b.key, { amount: v })} placeholder="Valor" aria-label={`Valor de ${b.name}`} />
              <DayInput value={b.day} onChange={(day) => update(b.key, { day })} />
              <button type="button" className="guided-icon-btn" aria-label="Remover" onClick={() => toggle(b.key, b.name)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="guided-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={total <= 0} onClick={() => s.go(q, `${formatBRL(total)} por mês`, 'PAY')}>
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
    case 'PAY': {
      const q = 'Como você costuma pagar essas contas?';
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-chips">
            {PAY_OPTIONS.map((o) => (
              <Chip key={o.id} label={o.label} active={false} onClick={() => s.finish(q, o.label, save(o.id))} />
            ))}
          </div>
        </Ask>
      );
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Naturezas
// ─────────────────────────────────────────────────────────────────────────────
const HAS_MODEL = /aliment|mercado|padaria|feira|refeiç|moradia|casa|habit|imóvel|imovel|transporte|veícul|veicul|carro|moto/i;
const CUSTOM_COLORS = ['#38bdf8', '#a78bfa', '#fb7185', '#34d399', '#fbbf24', '#60a5fa'];
const TYPE_OPTIONS: { id: ExpenseNature['type']; label: string }[] = [
  { id: 'FIXA', label: 'Fixo' },
  { id: 'VARIAVEL', label: 'Variável' },
  { id: 'ESSENCIAL', label: 'Essencial' },
];

const NaturezasTopic: React.FC<TopicProps> = (p) => {
  const { natures, addNature } = useFinancial();
  const s = useSteps<'HOW' | 'PICK' | 'CUSTOM' | 'TYPES' | 'MODELS'>('HOW', p);
  const [picked, setPicked] = useState<string[]>([]);
  const [customs, setCustoms] = useState<{ name: string; type: ExpenseNature['type'] }[]>([]);
  const exists = (name: string) => natures.some((n) => sameName(n.name, name));
  const chosenNames = [...picked, ...customs.map((c) => c.name)];
  const offersModels = chosenNames.some((n) => HAS_MODEL.test(n));

  const addCustom = (name: string) => !exists(name) && !chosenNames.some((n) => sameName(n, name)) && setCustoms((prev) => [...prev, { name, type: 'VARIAVEL' }]);

  const save = (withModels: boolean) => {
    const stamp = Date.now();
    SUGGESTED_NATURES.filter((t) => picked.includes(t.name)).forEach((t, idx) => {
      addNature({
        name: t.name,
        icon: t.icon,
        color: t.color,
        type: t.type,
        description: t.description,
        keywords: t.keywords,
        mappings: withModels && HAS_MODEL.test(t.name) ? buildSuggestedMappingsForNature(`nat_seed_${stamp}_${idx}`, t.name, t.icon) : [],
      });
    });
    customs.forEach((c, idx) => {
      addNature({ name: c.name, icon: '🏷️', color: CUSTOM_COLORS[idx % CUSTOM_COLORS.length], type: c.type, keywords: [c.name.toLowerCase()], mappings: [] });
    });
    const count = chosenNames.length;
    return `${count} natureza${count > 1 ? 's criadas' : ' criada'}: ${chosenNames.join(', ')}.${withModels ? ' Coloquei rotinas de exemplo para você só ajustar.' : ''}`;
  };

  const afterChoosing = (q: string, answer: string) => {
    if (customs.length > 0) return s.go(q, answer, 'TYPES');
    if (offersModels) return s.go(q, answer, 'MODELS');
    return s.finish(q, answer, save(false));
  };

  switch (s.step) {
    case 'HOW': {
      const q = `${natures.length > 0 ? `Você já tem ${natures.length} natureza${natures.length > 1 ? 's' : ''}: ${natures.map((n) => n.name).join(', ')}. ` : ''}Natureza é o grupo onde seus gastos se juntam, como Alimentação ou Moradia. Como prefere montar as suas?`;
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-choices">
            <Choice title="Escolher entre as sugestões" hint="Te mostro as mais comuns e você marca as suas." onClick={() => s.go(q, 'Escolher entre as sugestões', 'PICK')} />
            <Choice title="Criar as minhas do zero" hint="Você dá o nome de cada uma." onClick={() => s.go(q, 'Criar as minhas do zero', 'CUSTOM')} />
          </div>
        </Ask>
      );
    }
    case 'PICK': {
      const q = 'Quais destas fazem sentido para você?';
      const available = SUGGESTED_NATURES.filter((t) => !exists(t.name));
      return (
        <Ask question={q} hint={available.length < SUGGESTED_NATURES.length ? 'As que você já tem não aparecem aqui.' : undefined} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-choices is-compact">
            {available.map((t) => (
              <Choice
                key={t.name}
                title={`${t.icon} ${t.name}`}
                hint={t.description}
                active={picked.includes(t.name)}
                onClick={() => setPicked((prev) => (prev.includes(t.name) ? prev.filter((n) => n !== t.name) : [...prev, t.name]))}
              />
            ))}
          </div>
          {customs.length > 0 && (
            <div className="guided-chips">
              {customs.map((c) => (
                <Chip key={c.name} label={c.name} active onClick={() => setCustoms((prev) => prev.filter((x) => x.name !== c.name))} />
              ))}
            </div>
          )}
          <AddOther placeholder="Outra natureza (ex.: Filhos)" onAdd={addCustom} />
          <div className="guided-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={chosenNames.length === 0} onClick={() => afterChoosing(q, chosenNames.join(', '))}>
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
    case 'CUSTOM': {
      const q = 'Qual o nome de cada natureza que você quer criar?';
      return (
        <Ask question={q} hint="Ex.: Casa, Mercado, Filhos, Carro. Adicione uma de cada vez." onBack={s.back} backLabel={s.backLabel}>
          <AddOther placeholder="Nome da natureza" onAdd={addCustom} />
          {customs.length > 0 && (
            <div className="guided-chips">
              {customs.map((c) => (
                <Chip key={c.name} label={c.name} active onClick={() => setCustoms((prev) => prev.filter((x) => x.name !== c.name))} />
              ))}
            </div>
          )}
          <div className="guided-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={customs.length === 0} onClick={() => afterChoosing(q, customs.map((c) => c.name).join(', '))}>
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
    case 'TYPES': {
      const q = customs.length > 1 ? 'Como é o gasto em cada uma delas?' : `Como é o gasto em ${customs[0]?.name}?`;
      return (
        <Ask question={q} hint="Fixo: quase o mesmo valor todo mês. Variável: muda conforme o uso. Essencial: não dá para cortar." onBack={s.back} backLabel={s.backLabel}>
          {customs.map((c) => (
            <div key={c.name} className="guided-row">
              <span className="guided-row-name">{c.name}</span>
              <div className="guided-chips">
                {TYPE_OPTIONS.map((t) => (
                  <Chip key={t.id} label={t.label} active={c.type === t.id} onClick={() => setCustoms((prev) => prev.map((x) => (x.name === c.name ? { ...x, type: t.id } : x)))} />
                ))}
              </div>
            </div>
          ))}
          <div className="guided-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                const answer = customs.map((c) => `${c.name}: ${TYPE_OPTIONS.find((t) => t.id === c.type)!.label.toLowerCase()}`).join(' · ');
                if (offersModels) s.go(q, answer, 'MODELS');
                else s.finish(q, answer, save(false));
              }}
            >
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
    case 'MODELS': {
      const q = 'Quer que eu já coloque rotinas de exemplo (como supermercado, feira e contas da casa) para você só ajustar os valores?';
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-choices">
            <Choice title="Sim, coloca os exemplos" hint="Você confere e ajusta depois." onClick={() => s.finish(q, 'Sim, coloca os exemplos', save(true))} />
            <Choice title="Não, eu mapeio do meu jeito" hint="Te pergunto rotina por rotina em Mapeamentos." onClick={() => s.finish(q, 'Não, eu mapeio do meu jeito', save(false))} />
          </div>
        </Ask>
      );
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamentos das naturezas
// ─────────────────────────────────────────────────────────────────────────────
type Freq = 'SEMANAL' | 'QUINZENAL' | 'MENSAL';
const WEEKDAYS: { id: NonNullable<MappingItem['dayOfWeek']>; label: string }[] = [
  { id: 'SEGUNDA', label: 'Segunda' },
  { id: 'TERCA', label: 'Terça' },
  { id: 'QUARTA', label: 'Quarta' },
  { id: 'QUINTA', label: 'Quinta' },
  { id: 'SEXTA', label: 'Sexta' },
  { id: 'SABADO', label: 'Sábado' },
  { id: 'DOMINGO', label: 'Domingo' },
];
const FREQ_MULT: Record<Freq, number> = { SEMANAL: 4, QUINZENAL: 2, MENSAL: 1 };

const MapeamentosTopic: React.FC<TopicProps> = (p) => {
  const { natures, updateNature } = useFinancial();
  const s = useSteps<'EMPTY' | 'NATURE' | 'ROUTINE' | 'FREQ' | 'WEEKDAY' | 'DAY' | 'ITEMS' | 'PAY' | 'MORE'>(natures.length === 0 ? 'EMPTY' : 'NATURE', p);
  const [natureId, setNatureId] = useState('');
  const [routine, setRoutine] = useState('');
  const [freq, setFreq] = useState<Freq>('MENSAL');
  const [weekday, setWeekday] = useState<NonNullable<MappingItem['dayOfWeek']>>('SABADO');
  const [day, setDay] = useState(10);
  const [rows, setRows] = useState<{ description: string; quantity: number; price: number }[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const nature = natures.find((n) => n.id === natureId);
  const perTime = rows.reduce((acc, r) => acc + (r.quantity || 0) * (r.price || 0), 0);
  const monthly = perTime * FREQ_MULT[freq];

  const startRoutine = (name: string) => {
    setRoutine(name);
    setRows([{ description: name, quantity: 1, price: 0 }]);
  };
  const updateRow = (idx: number, changes: Partial<{ description: string; quantity: number; price: number }>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...changes } : r)));

  const save = (payment: NonNullable<MappingItem['paymentMethod']>) => {
    if (!nature) return;
    const stamp = Date.now();
    const when =
      freq === 'SEMANAL' ? { dayOfWeek: weekday } : freq === 'QUINZENAL' ? { dayOfFortnight: clampDay(day, 15) } : { dayOfMonth: day };
    const items: MappingItem[] = rows
      .filter((r) => r.price > 0 && r.description.trim())
      .map((r, i) => ({
        id: `item_${stamp}_${i}`,
        description: r.description.trim(),
        quantity: r.quantity || 1,
        price: r.price,
        unit: 'un',
        multiplierWeeks: FREQ_MULT[freq],
        totalValue: (r.quantity || 1) * r.price * FREQ_MULT[freq],
        realizedValue: 0,
        isFulfilled: false,
        paymentMethod: payment,
        recurrenceType: freq,
        ...when,
      }));
    const mapping: FixedExpenseMapping = {
      id: `map_${stamp}`,
      name: routine,
      natureId: nature.id,
      icon: nature.icon,
      applicableMonths: [],
      frequency: freq,
      ...(freq === 'SEMANAL' ? { dayOfWeek: WEEKDAYS.find((w) => w.id === weekday)!.label } : { dayOfMonth: day }),
      items,
      keywords: [routine.toLowerCase()],
    };
    updateNature(nature.id, { mappings: [...nature.mappings, mapping] });
    setSaved((prev) => [...prev, `${routine} (${nature.name})`]);
  };

  const summary = () =>
    saved.length > 0 ? `${saved.length} rotina${saved.length > 1 ? 's mapeadas' : ' mapeada'}: ${saved.join(', ')}.` : 'Nada mapeado por enquanto.';

  switch (s.step) {
    case 'EMPTY': {
      const q = 'Para mapear, primeiro preciso saber quais são as suas naturezas. Vamos criá-las agora?';
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-actions is-start">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { p.log(q, 'Criar naturezas agora'); p.onSwitch('NATUREZAS'); }}>
              Criar naturezas agora
            </button>
          </div>
        </Ask>
      );
    }
    case 'NATURE': {
      const q = saved.length > 0 ? 'Qual natureza agora?' : 'Qual natureza você quer detalhar?';
      return (
        <Ask question={q} hint="Mapear é contar o que você compra ali, quanto custa e quando. O teto da natureza vira a soma disso." onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-choices is-compact">
            {natures.map((n) => {
              const count = n.mappings.length;
              return (
                <Choice
                  key={n.id}
                  title={`${n.icon} ${n.name}`}
                  hint={count > 0 ? `${count} mapeamento${count > 1 ? 's' : ''}` : 'Nada mapeado ainda'}
                  onClick={() => { setNatureId(n.id); s.go(q, n.name, 'ROUTINE'); }}
                />
              );
            })}
          </div>
        </Ask>
      );
    }
    case 'ROUTINE': {
      const q = `Que gasto se repete em ${nature?.name}?`;
      const suggestions = suggestedRoutinesFor(nature?.name || '').filter((r) => !nature?.mappings.some((m) => sameName(m.name, r)));
      return (
        <Ask question={q} hint={suggestions.length > 0 ? 'Escolha um ou escreva o seu.' : 'Escreva o nome do gasto, ex.: Mensalidade, Ração.'} onBack={s.back} backLabel={s.backLabel}>
          {suggestions.length > 0 && (
            <div className="guided-chips">
              {suggestions.map((r) => (
                <Chip key={r} label={r} active={routine === r} onClick={() => startRoutine(r)} />
              ))}
            </div>
          )}
          <AddOther placeholder="Outro gasto" onAdd={startRoutine} />
          {routine && !suggestions.includes(routine) && (
            <div className="guided-chips">
              <Chip label={routine} active onClick={() => setRoutine('')} />
            </div>
          )}
          <div className="guided-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={!routine} onClick={() => s.go(q, routine, 'FREQ')}>
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
    case 'FREQ': {
      const q = `Com que frequência você tem ${routine.toLowerCase()}?`;
      const pick = (f: Freq, label: string) => {
        setFreq(f);
        if (f === 'QUINZENAL') setDay((d) => clampDay(d, 15));
        s.go(q, label, f === 'SEMANAL' ? 'WEEKDAY' : 'DAY');
      };
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-choices">
            <Choice title="Toda semana" onClick={() => pick('SEMANAL', 'Toda semana')} />
            <Choice title="A cada quinzena" onClick={() => pick('QUINZENAL', 'A cada quinzena')} />
            <Choice title="Todo mês" onClick={() => pick('MENSAL', 'Todo mês')} />
          </div>
        </Ask>
      );
    }
    case 'WEEKDAY': {
      const q = 'Em que dia da semana, normalmente?';
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-chips">
            {WEEKDAYS.map((w) => (
              <Chip key={w.id} label={w.label} active={weekday === w.id} onClick={() => { setWeekday(w.id); s.go(q, w.label, 'ITEMS'); }} />
            ))}
          </div>
        </Ask>
      );
    }
    case 'DAY': {
      const q = freq === 'QUINZENAL' ? 'Em que dia da primeira quinzena? A segunda vem 15 dias depois.' : 'Em que dia do mês, normalmente?';
      const max = freq === 'QUINZENAL' ? 15 : 31;
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <DayInput value={day} max={max} onChange={setDay} />
          <div className="guided-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => s.go(q, `Dia ${day}`, 'ITEMS')}>
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
    case 'ITEMS': {
      const q = `O que entra em ${routine.toLowerCase()} e quanto custa cada vez?`;
      return (
        <Ask question={q} hint="Pode ser um valor só ou item por item (quantidade × preço)." onBack={s.back} backLabel={s.backLabel}>
          {rows.map((r, idx) => (
            <div key={idx} className="guided-row">
              <input className="form-input form-input-sm" value={r.description} onChange={(e) => updateRow(idx, { description: e.target.value })} aria-label="Item" placeholder="Item" />
              <input
                type="number"
                min={1}
                className="form-input form-input-sm guided-qty"
                value={r.quantity}
                onChange={(e) => updateRow(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                aria-label="Quantidade"
              />
              <DecimalInput className="form-input form-input-sm" money value={r.price} emptyWhenZero onValueChange={(v) => updateRow(idx, { price: v })} placeholder="Preço" aria-label="Preço" />
              {rows.length > 1 && (
                <button type="button" className="guided-icon-btn" aria-label="Remover" onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <button type="button" className="link-button" onClick={() => setRows((prev) => [...prev, { description: '', quantity: 1, price: 0 }])}>
            + Outro item
          </button>
          {perTime > 0 && (
            <p className="guided-hint">
              {formatBRL(perTime)} por vez · cerca de <strong>{formatBRL(monthly)}</strong> por mês
            </p>
          )}
          <div className="guided-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={perTime <= 0} onClick={() => s.go(q, `${formatBRL(perTime)} por vez`, 'PAY')}>
              Continuar
            </button>
          </div>
        </Ask>
      );
    }
    case 'PAY': {
      const q = 'E como você costuma pagar?';
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-chips">
            {PAY_OPTIONS.map((o) => (
              <Chip key={o.id} label={o.label} active={false} onClick={() => { save(o.id); s.go(q, o.label, 'MORE'); }} />
            ))}
          </div>
        </Ask>
      );
    }
    case 'MORE': {
      const q = `Anotado: ${routine} em ${nature?.name}, cerca de ${formatBRL(monthly)} por mês. Quer mapear mais alguma coisa?`;
      return (
        <Ask question={q}>
          <div className="guided-choices">
            <Choice title={`Outro gasto em ${nature?.name}`} onClick={() => { setRoutine(''); s.go(q, `Outro gasto em ${nature?.name}`, 'ROUTINE'); }} />
            <Choice title="Outra natureza" onClick={() => { setRoutine(''); s.go(q, 'Outra natureza', 'NATURE'); }} />
            <Choice title="Por enquanto é só" onClick={() => s.finish(q, 'Por enquanto é só', summary())} />
          </div>
        </Ask>
      );
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Acompanhamento
// ─────────────────────────────────────────────────────────────────────────────
const PERIODS: [TrackingPeriod, string, string][] = [
  ['SEMANA', 'Toda semana', 'Aviso na hora, ex.: "já gastamos bastante comendo fora nesta semana".'],
  ['QUINZENA', 'A cada quinzena', 'Um resumo do dia 1 ao 15 e do 16 ao fim do mês.'],
  ['MES', 'Todo mês', 'Uma visão do mês inteiro.'],
];

const AcompanhamentoTopic: React.FC<TopicProps> = (p) => {
  const { setViewPreferences } = useFinancial();
  const s = useSteps<'PERIOD' | 'HOME'>('PERIOD', p);
  const [period, setPeriod] = useState<TrackingPeriod>('MES');

  switch (s.step) {
    case 'PERIOD': {
      const q = 'De quanto em quanto tempo você quer que eu te mostre como estão os gastos?';
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-choices">
            {PERIODS.map(([id, label, hint]) => (
              <Choice key={id} title={label} hint={hint} onClick={() => { setPeriod(id); s.go(q, label, 'HOME'); }} />
            ))}
          </div>
        </Ask>
      );
    }
    case 'HOME': {
      const q = 'E qual tela você prefere ver quando abrir o Balder?';
      const pick = (homeScreen: 'INICIO' | 'PAINEL', label: string) => {
        setViewPreferences({ trackingPeriod: period });
        p.setHomeScreen(homeScreen);
        s.finish(q, label, `Resumos ${PERIODS.find((x) => x[0] === period)![1].toLowerCase()}, abrindo no ${homeScreen === 'INICIO' ? 'Início' : 'Painel'}.`);
      };
      return (
        <Ask question={q} onBack={s.back} backLabel={s.backLabel}>
          <div className="guided-choices">
            <Choice title="Início" hint="Conversa comigo e o que vence no período." onClick={() => pick('INICIO', 'Início')} />
            <Choice title="Painel" hint="Gráficos e números completos." onClick={() => pick('PAINEL', 'Painel')} />
          </div>
        </Ask>
      );
    }
  }
};

const TOPIC_COMPONENTS: Record<SetupTopic, React.FC<TopicProps>> = {
  INICIO: InicioTopic,
  ENTRADAS: EntradasTopic,
  CARTOES: CartoesTopic,
  CONTAS: ContasTopic,
  NATUREZAS: NaturezasTopic,
  MAPEAMENTOS: MapeamentosTopic,
  ACOMPANHAMENTO: AcompanhamentoTopic,
};

// ─────────────────────────────────────────────────────────────────────────────
// Conversa por assuntos
// ─────────────────────────────────────────────────────────────────────────────
interface ForsetiTopicSetupProps {
  /** Abre direto num assunto (ex.: vindo da lista de pendências). Sem ele, a Forseti pergunta por onde começar. */
  initialTopic?: SetupTopic;
  onFinished: () => void;
  finishLabel?: string;
  /** No primeiro acesso a conversa fica no Início: a tela inicial escolhida só vale ao terminar. */
  holdHomeScreen?: boolean;
}

/**
 * Configuração em que a pessoa escolhe o que configurar: a Forseti oferece os assuntos (ponto de partida,
 * entradas, cartões, contas do mês, naturezas, mapeamentos, acompanhamento), sugere por onde seguir e
 * conduz cada um com perguntas. Cada assunto é salvo ao terminar.
 */
export const ForsetiTopicSetup: React.FC<ForsetiTopicSetupProps> = ({ initialTopic, onFinished, finishLabel = 'Ir para o Início', holdHomeScreen }) => {
  const { user } = useAuth();
  const { activeCheckpoint, accounts, banks, movements, cards, natures, viewPreferences, setViewPreferences } = useFinancial();
  const [heldHomeScreen, setHeldHomeScreen] = useState<'INICIO' | 'PAINEL' | null>(null);
  const [turns, setTurns] = useState<{ question: string; answer: string }[]>([]);
  const [phase, setPhase] = useState<'MENU' | 'TOPIC' | 'CHECK' | 'DONE'>(initialTopic ? 'TOPIC' : 'MENU');
  const [topic, setTopic] = useState<SetupTopic | null>(initialTopic || null);
  const [topicRun, setTopicRun] = useState(0);
  const [cameFromMenu, setCameFromMenu] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [answered, setAnswered] = useState<SetupTopic[]>([]);

  const done: Record<SetupTopic, boolean> = {
    INICIO: !!activeCheckpoint && (accounts.length > 0 || banks.length > 0),
    ENTRADAS: movements.some((m) => m.type === 'RECEBER'),
    CARTOES: cards.length > 0,
    CONTAS: natures.some((n) => n.mappings.some((m) => m.name === 'Contas do mês')),
    NATUREZAS: natures.length > 0,
    MAPEAMENTOS: natures.some((n) => n.mappings.some((m) => m.items.length > 0)),
    ACOMPANHAMENTO: !!viewPreferences.trackingPeriod,
  };
  const isDone = (t: SetupTopic) => done[t] || answered.includes(t);
  const suggestion = TOPICS.find((t) => !isDone(t.id));

  const log = (question: string, answer: string) => setTurns((prev) => [...prev, { question, answer }]);
  const unlog = () => setTurns((prev) => prev.slice(0, -1));

  const openTopic = (t: SetupTopic, fromMenu: boolean) => {
    setTopic(t);
    setCameFromMenu(fromMenu);
    setTopicRun((n) => n + 1);
    setPhase('TOPIC');
  };

  const completeSetup = () => {
    if (user && !user.isGuest) {
      localStorage.setItem(`balder_onboarding_completed_${user.$id}`, 'true');
      SupabaseService.saveUserProfileSettings({ onboardingCompleted: true }).catch(console.error);
    } else {
      localStorage.setItem('balder_onboarding_completed_guest', 'true');
    }
    setPhase('DONE');
  };

  const topicProps: TopicProps = {
    log,
    unlog,
    onDone: (text) => {
      if (topic) setAnswered((prev) => [...prev, topic]);
      setSummary(text);
      setPhase('MENU');
    },
    onCancel: () => {
      if (cameFromMenu) unlog();
      setPhase('MENU');
    },
    onSwitch: (t) => openTopic(t, false),
    setHomeScreen: (homeScreen) => (holdHomeScreen ? setHeldHomeScreen(homeScreen) : setViewPreferences({ homeScreen })),
  };

  const firstTime = turns.length === 0 && !summary;
  const menuQuestion = `${summary ? `${summary} ` : ''}${firstTime ? 'Vamos configurar do seu jeito. Por onde você quer começar?' : 'O que configuramos agora?'}`;
  const checkQuestion = 'Antes de parar: sem o ponto de partida eu não consigo projetar o seu saldo. Quer definir agora? Leva um minuto.';
  const pending = TOPICS.filter((t) => !isDone(t.id));
  const TopicView = topic ? TOPIC_COMPONENTS[topic] : null;

  return (
    <div className="guided-setup">
      {turns.map((t, i) => (
        <React.Fragment key={i}>
          <Bubble from="forseti">{t.question}</Bubble>
          <Bubble from="user">{t.answer}</Bubble>
        </React.Fragment>
      ))}

      {phase === 'MENU' && (
        <Ask
          scrollKey={menuQuestion}
          question={
            <>
              <p>{menuQuestion}</p>
              {suggestion && (
                <p className="guided-suggestion">
                  Minha sugestão: <strong>{suggestion.label}</strong>, porque {suggestion.why}.
                </p>
              )}
            </>
          }
        >
          <div className="guided-choices">
            {TOPICS.map((t) => (
              <Choice
                key={t.id}
                title={t.label}
                hint={t.hint}
                badge={isDone(t.id) ? 'feito' : suggestion?.id === t.id ? 'sugestão' : undefined}
                active={suggestion?.id === t.id}
                onClick={() => {
                  log(menuQuestion, t.label);
                  openTopic(t.id, true);
                }}
              />
            ))}
          </div>
          <div className="guided-actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                log(menuQuestion, 'Por enquanto é isso');
                if (!activeCheckpoint) setPhase('CHECK');
                else completeSetup();
              }}
            >
              Por enquanto é isso
            </button>
          </div>
        </Ask>
      )}

      {phase === 'TOPIC' && TopicView && <TopicView key={topicRun} {...topicProps} />}

      {phase === 'CHECK' && (
        <Ask question={checkQuestion}>
          <div className="guided-actions is-start">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { log(checkQuestion, 'Deixar para depois'); completeSetup(); }}>
              Deixar para depois
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { log(checkQuestion, 'Definir agora'); openTopic('INICIO', false); }}>
              Definir agora
            </button>
          </div>
        </Ask>
      )}

      {phase === 'DONE' && (
        <>
          <Bubble from="forseti">
            <p>
              Tudo certo!{' '}
              {pending.length > 0
                ? `Quando quiser, ainda dá para configurar: ${pending.map((t) => t.label.toLowerCase()).join(', ')}. É só me chamar.`
                : 'Seu Balder está completo.'}
            </p>
            <p>Daqui pra frente é só me contar o que acontecer: "paguei 50 no mercado", "recebi 300 de um freela" ou uma foto do cupom.</p>
          </Bubble>
          <div className="guided-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (heldHomeScreen) setViewPreferences({ homeScreen: heldHomeScreen });
                onFinished();
              }}
            >
              {heldHomeScreen === 'PAINEL' ? 'Ir para o Painel' : finishLabel}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

