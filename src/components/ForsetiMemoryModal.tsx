import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';
import {
  MEMORY_BODY_MAX, MEMORY_KINDS, MEMORY_KIND_LABEL, MEMORY_LIMIT, type MemoryKind, parseMemory, titleFromBody,
} from '../utils/forsetiMemory';

const KIND_ICON: Record<MemoryKind, string> = { PREFERENCIA: '👍', RESTRICAO: '🚫', CONTEXTO: '👨‍👩‍👧', PRIORIDADE: '🎯' };

interface Draft {
  id?: string;
  kind: MemoryKind;
  body: string;
}

/**
 * O que a Forseti guarda sobre você: ver, editar, acrescentar e apagar. A Forseti só guarda algo novo depois do seu
 * "Confirmar" no chat, e nunca valores em reais, documentos, e-mails ou links.
 */
export const ForsetiMemoryModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const {
    forsetiMemories, forsetiMemoryLocalOnly, saveForsetiMemory, updateForsetiMemory, removeForsetiMemory, clearForsetiMemories,
  } = useFinancial();
  const { confirm, dialogProps } = useConfirmDialog();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const startNew = () => {
    setError('');
    setDraft({ kind: 'PREFERENCIA', body: '' });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const valid = parseMemory({ kind: draft.kind, body: draft.body, title: titleFromBody(draft.body) });
    if (!valid) {
      setError('Não consegui guardar esse texto. Escreva uma frase curta, sem valores em reais, números de documento, e-mails ou links.');
      return;
    }
    if (draft.id) {
      if (!updateForsetiMemory(draft.id, valid)) setError('Não encontrei mais essa memória.');
      else setDraft(null);
      return;
    }
    const saved = saveForsetiMemory(valid);
    if (saved.ok) setDraft(null);
    else setError(saved.reason === 'DUPLICADA' ? 'Isso já está guardado.' : saved.reason === 'LIMITE' ? `O limite é de ${MEMORY_LIMIT} memórias: apague alguma antes.` : 'Entre na sua conta para guardar memórias.');
  };

  const askClear = () =>
    confirm({
      title: 'Esquecer tudo?',
      message: `A Forseti vai apagar as ${forsetiMemories.length} coisas que guardou sobre você. Isso não pode ser revertido.`,
      confirmLabel: 'Esquecer tudo',
      onConfirm: clearForsetiMemories,
    });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="O que a Forseti sabe sobre você"
      subtitle={`${forsetiMemories.length} de ${MEMORY_LIMIT} · só você vê, edita e apaga`}
      maxWidth="560px"
    >
      {forsetiMemories.length === 0 && !draft ? (
        <p className="home-empty">
          A Forseti ainda não guardou nada. Para ela lembrar de algo, diga no chat, por exemplo: “lembra que eu evito parcelar” ou
          “minha prioridade é quitar o empréstimo”. Ela sempre pergunta antes de guardar.
        </p>
      ) : (
        <ul className="home-task-list forseti-memory-list">
          {forsetiMemories.map((m) => (
            <li key={m.id}>
              <span className="forseti-activity-icon" aria-hidden="true">
                {KIND_ICON[m.kind]}
              </span>
              <div className="home-task-main">
                <span className="home-task-title">{m.body}</span>
                <span className="home-task-meta">{MEMORY_KIND_LABEL[m.kind]}</span>
              </div>
              <div className="forseti-activity-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  aria-label="Editar"
                  title="Editar"
                  onClick={() => {
                    setError('');
                    setDraft({ id: m.id, kind: m.kind, body: m.body });
                  }}
                >
                  <Pencil size={13} />
                </button>
                <button type="button" className="btn btn-outline btn-xs" aria-label="Apagar" title="Apagar" onClick={() => removeForsetiMemory(m.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <form className="forseti-memory-form" onSubmit={submit}>
          <select
            className="form-select"
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as MemoryKind })}
            aria-label="Tipo"
          >
            {MEMORY_KINDS.map((k) => (
              <option key={k} value={k}>
                {MEMORY_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <textarea
            className="form-input"
            rows={2}
            maxLength={MEMORY_BODY_MAX}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder="Ex.: Evito parcelar compras"
            aria-label="O que a Forseti deve lembrar"
            autoFocus
          />
          {error && <p className="text-xs text-rose" role="alert">{error}</p>}
          <div className="forseti-memory-form-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setDraft(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={draft.body.trim().length < 3}>
              Guardar
            </button>
          </div>
        </form>
      ) : (
        <div className="forseti-memory-form-actions">
          {forsetiMemories.length > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={askClear}>
              Esquecer tudo
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={startNew} disabled={forsetiMemories.length >= MEMORY_LIMIT}>
            <Plus size={14} /> Acrescentar
          </button>
        </div>
      )}

      <p className="text-xs text-muted">
        A Forseti usa isso para te responder melhor (resumo do dia, compras, quitação). Nunca guardo valores em reais, documentos, contas,
        e-mails ou links, e nada disso é enviado junto dos seus números.
      </p>
      {forsetiMemoryLocalOnly && (
        <p className="text-xs text-muted">
          Estas memórias estão guardadas só neste aparelho. Para sincronizar, crie a tabela forseti_memories no Supabase
          (supabase/forseti_memories.sql).
        </p>
      )}
      <ConfirmDialog {...dialogProps} />
    </Modal>
  );
};
