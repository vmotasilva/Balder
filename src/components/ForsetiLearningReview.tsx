import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, Check } from 'lucide-react';
import { ForsetiLearningService } from '../services/forsetiLearningService';
import {
  type LearningReport, NEW_INTENT, handledEverywhere, pendingGroups, pendingSuggestions, signalsOf, testCaseLine, testCaseSnippet,
  toggleHandled, usageShares,
} from '../utils/forsetiLearningReview';

const fmtDay = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Revisão do relatório diário de aprendizado da Forseti (só gestores): as frases que ela atendeu mal e as sugestões de regra,
 * com "copiar caso de teste" e "marcar como tratada". Nada muda sozinho: as regras continuam no código.
 */
export const ForsetiLearningReview: React.FC = () => {
  const [reports, setReports] = useState<LearningReport[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [showHandled, setShowHandled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await ForsetiLearningService.list();
      setReports(list);
      setSelected((cur) => (list.some((r) => r.date === cur) ? cur : list[0]?.date || ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar os relatórios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const report = reports.find((r) => r.date === selected);
  const handled = useMemo(() => handledEverywhere(reports), [reports]);
  const suggestions = report ? (showHandled ? report.suggestions : pendingSuggestions(report, handled)) : [];
  const groups = report ? (showHandled ? report.groups : pendingGroups(report, handled)) : [];

  const say = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 4000);
  };

  const copy = async (content: string, done: string) => {
    try {
      await navigator.clipboard.writeText(content);
      say(done);
    } catch {
      say('Não consegui copiar. Selecione o texto da frase e copie à mão.');
    }
  };

  const toggle = async (phrase: string) => {
    if (!report) return;
    const next = toggleHandled(report.handled, phrase);
    // Se a frase foi tratada em outro dia, desmarcar também lá: senão ela continuaria escondida
    const others = reports.filter((r) => r.date !== report.date && r.handled.includes(phrase) && report.handled.includes(phrase));
    try {
      await Promise.all([
        ForsetiLearningService.setHandled(report.date, next),
        ...others.map((r) => ForsetiLearningService.setHandled(r.date, toggleHandled(r.handled, phrase))),
      ]);
      setReports((prev) =>
        prev.map((r) =>
          r.date === report.date ? { ...r, handled: next } : others.some((o) => o.date === r.date) ? { ...r, handled: toggleHandled(r.handled, phrase) } : r
        )
      );
    } catch (e) {
      say(e instanceof Error ? e.message : 'Não foi possível salvar.');
    }
  };

  if (loading) return <p className="text-muted">Carregando…</p>;
  if (error) return <div className="badge badge-rose">{error}</div>;
  if (reports.length === 0) {
    return (
      <p className="text-muted">
        Ainda não há relatórios. A rotina diária (6h) grava um por dia, a partir das solicitações das últimas 24 horas à Forseti.
      </p>
    );
  }

  const snippet = testCaseSnippet(suggestions);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
        <select className="form-select" style={{ maxWidth: 220 }} value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Dia do relatório">
          {reports.map((r) => (
            <option key={r.date} value={r.date}>
              {fmtDay(r.date)} · {r.totalRequests} solicitações
            </option>
          ))}
        </select>
        <label className="text-sm" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={showHandled} onChange={(e) => setShowHandled(e.target.checked)} /> Mostrar as já tratadas
        </label>
      </div>
      <p className="text-muted text-sm">
        Frases sem números, e-mails nem links. “Copiar caso de teste” gera a linha para <code>REPORT_CASES</code> em
        <code> src/utils/forsetiEvalCases.ts</code>; a regra em si é escrita no código.
      </p>
      {notice && <p className="text-sm text-emerald" role="status">{notice}</p>}

      <section className="space-y-2">
        <h4>Quem resolveu as frases digitadas</h4>
        <p className="text-muted text-sm">
          Regras são rápidas e sem custo; “só a IA” tem custo e mostra o que falta virar regra; “sem resposta” inclui o que a IA também não resolveu.
        </p>
        <div className="admin-users-table-wrap">
          <table className="movements-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Dia</th>
                <th title="Frases digitadas na conversa">Frases</th>
                <th>Regras</th>
                <th>Só a IA</th>
                <th>Sem resposta</th>
                <th title="Respostas avaliadas como não úteis">Não úteis</th>
                <th title="Ações desfeitas">Desfeitas</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const s = r.stats;
                const share = s ? usageShares(s) : null;
                return (
                  <tr key={r.date} style={r.date === selected ? { fontWeight: 600 } : undefined}>
                    <td>{fmtDay(r.date)}</td>
                    <td>{s ? s.conversation : '—'}</td>
                    <td>{share ? `${share.rules}%` : '—'}</td>
                    <td>{share ? `${share.ai}%` : '—'}</td>
                    <td>{share ? `${share.notUnderstood}%` : '—'}</td>
                    <td>{s ? s.notUseful : '—'}</td>
                    <td>{s ? s.undone : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {reports.some((r) => !r.stats) && (
          <p className="text-muted text-sm">
            Dias sem números foram gerados antes das métricas existirem (ou o script <code>supabase/forseti_learning_reports.sql</code> ainda não foi rodado de novo).
          </p>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex gap-2 items-center" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h4>Sugestões de regra ({suggestions.length})</h4>
          {snippet && (
            <button className="btn btn-outline btn-xs" onClick={() => void copy(snippet, 'Casos de teste copiados.')}>
              <ClipboardCopy size={13} /> Copiar todos os casos
            </button>
          )}
        </div>
        {suggestions.length === 0 && <p className="text-muted text-sm">Nenhuma sugestão pendente neste dia.</p>}
        <ul className="home-task-list">
          {suggestions.map((s) => {
            const done = handled.has(s.phrase);
            const line = testCaseLine(s);
            return (
              <li key={s.phrase} className={done ? 'is-undone' : ''}>
                <div className="home-task-main">
                  <span className="home-task-title">“{s.phrase}”</span>
                  <span className="forseti-activity-result">
                    <span className={`badge ${s.intent === NEW_INTENT ? 'badge-amber' : 'badge-cyan'}`}>{s.intent === NEW_INTENT ? 'Intenção nova' : s.intent}</span>
                    {s.keywords.length > 0 && <> · {s.keywords.join(', ')}</>}
                  </span>
                  {s.note && <span className="home-task-meta">{s.note}</span>}
                </div>
                <div className="forseti-activity-actions">
                  {line && (
                    <button className="btn btn-outline btn-xs" onClick={() => void copy(line, 'Caso de teste copiado.')} title="Copiar caso de teste">
                      <ClipboardCopy size={13} />
                    </button>
                  )}
                  <button className={`btn btn-xs ${done ? 'btn-primary' : 'btn-outline'}`} onClick={() => void toggle(s.phrase)} aria-pressed={done}>
                    <Check size={13} /> {done ? 'Tratada' : 'Marcar'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <h4>Frases mal atendidas ({groups.length})</h4>
        <div className="admin-users-table-wrap">
          <table className="movements-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Frase</th>
                <th title="Vezes pedidas">Pedidos</th>
                <th title="Não entendeu">Não entendeu</th>
                <th title="Avaliada como não útil">Não útil</th>
                <th title="Ação desfeita">Desfeita</th>
                <th title="Só a IA entendeu: candidata a regra">Via IA</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.phrase} className={handled.has(g.phrase) ? 'is-undone' : ''}>
                  <td>{g.phrase}</td>
                  <td>{g.total}</td>
                  <td>{g.notUnderstood}</td>
                  <td>{g.notUseful}</td>
                  <td>{g.undone}</td>
                  <td>{g.viaAi}</td>
                  <td>
                    <button className={`btn btn-xs ${handled.has(g.phrase) ? 'btn-primary' : 'btn-outline'}`} onClick={() => void toggle(g.phrase)} title={`${signalsOf(g)} sinal(is)`}>
                      <Check size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr><td colSpan={7} className="text-muted">Nenhuma frase pendente neste dia.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
