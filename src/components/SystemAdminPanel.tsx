import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Search, Users, Wallet, Crown, FlaskConical, Plus } from 'lucide-react';
import { Modal } from './Modal';
import {
  AdminService,
  STATUS_LABEL,
  effectiveMonthlyCents,
  formatBRL,
  type ManagedUser,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from '../services/adminService';

const STATUSES = Object.keys(STATUS_LABEL) as SubscriptionStatus[];
const STATUS_BADGE: Record<SubscriptionStatus, string> = {
  TESTE: 'badge-cyan',
  ATIVA: 'badge-emerald',
  SUSPENSA: 'badge-amber',
  CANCELADA: 'badge-rose',
};

const centsToInput = (c: number | null) => (c === null ? '' : (c / 100).toFixed(2).replace('.', ','));
const inputToCents = (v: string): number | null => {
  const t = v.trim().replace(/\./g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};
const limitToInput = (n: number | null) => (n === null ? '' : String(n));
const inputToLimit = (v: string): number | null => {
  const n = parseInt(v, 10);
  return v.trim() && Number.isFinite(n) && n >= 0 ? n : null;
};
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

export const SystemAdminPanel: React.FC = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'USUARIOS' | 'PLANOS'>('USUARIOS');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ManagedUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, u] = await Promise.all([AdminService.listPlans(), AdminService.listUsers()]);
      setPlans(p);
      setUsers(u);
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar a gestão.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const paying = users.filter((u) => u.status === 'ATIVA');
    return {
      total: users.length,
      testing: users.filter((u) => u.status === 'TESTE').length,
      paying: paying.length,
      mrr: paying.reduce((sum, u) => sum + effectiveMonthlyCents(u, plans), 0),
    };
  }, [users, plans]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q));
  }, [users, search]);

  const planName = (code: string | null) => plans.find((p) => p.code === code)?.name || code || '—';

  return (
    <div className="subtab-content animate-fade-in space-y-6">
      <div>
        <div className="kicker-badge" style={{ marginBottom: '0.25rem' }}>
          <span>GESTÃO DO SISTEMA</span>
        </div>
        <h3>Usuários & Assinaturas</h3>
        <p className="text-muted">Visível apenas para gestores do Balder.</p>
      </div>

      {error && <div className="badge badge-rose">{error}</div>}

      <div className="stat-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
        {[
          { icon: Users, label: 'Usuários', value: stats.total },
          { icon: FlaskConical, label: 'Em teste', value: stats.testing },
          { icon: Crown, label: 'Assinaturas ativas', value: stats.paying },
          { icon: Wallet, label: 'Receita mensal', value: formatBRL(stats.mrr) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">{label}</span>
              <Icon size={16} />
            </div>
            <div className="stat-card-value">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button className={`btn btn-sm ${tab === 'USUARIOS' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('USUARIOS')}>
          Usuários ({users.length})
        </button>
        <button className={`btn btn-sm ${tab === 'PLANOS' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('PLANOS')}>
          Planos ({plans.length})
        </button>
      </div>

      {loading && <p className="text-muted">Carregando…</p>}

      {!loading && tab === 'USUARIOS' && (
        <div className="space-y-3">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 12, opacity: 0.6 }} />
            <input
              className="form-input"
              style={{ paddingLeft: 30 }}
              placeholder="Buscar por nome ou e-mail"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="movements-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Plano</th>
                  <th>Situação</th>
                  <th>Mensal</th>
                  <th>Cadastro</th>
                  <th>Último acesso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.userId}>
                    <td>
                      <strong>{u.name || u.email.split('@')[0]}</strong>
                      {u.systemRole !== 'USUARIO' && <span className="badge badge-purple" style={{ marginLeft: 6 }}>{u.systemRole}</span>}
                      <br />
                      <small className="text-muted">{u.email}</small>
                    </td>
                    <td>{planName(u.planCode)}</td>
                    <td><span className={`badge ${STATUS_BADGE[u.status]}`}>{STATUS_LABEL[u.status]}</span></td>
                    <td>
                      {formatBRL(effectiveMonthlyCents(u, plans))}
                      {u.customMonthlyPriceCents !== null && <small className="text-muted"> (negociado)</small>}
                    </td>
                    <td>{fmtDate(u.createdAt)}</td>
                    <td>{fmtDate(u.lastSignInAt)}</td>
                    <td>
                      <button className="btn btn-outline btn-xs" onClick={() => setEditing(u)} title="Ajustar assinatura">
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-muted">Nenhum usuário encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'PLANOS' && (
        <PlansEditor plans={plans} users={users} onChanged={load} />
      )}

      {editing && (
        <UserSubscriptionModal
          user={editing}
          plans={plans}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
};

const UserSubscriptionModal: React.FC<{
  user: ManagedUser;
  plans: SubscriptionPlan[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ user, plans, onClose, onSaved }) => {
  const [planCode, setPlanCode] = useState(user.planCode || plans.find((p) => p.isDefault)?.code || '');
  const [status, setStatus] = useState<SubscriptionStatus>(user.status);
  const [price, setPrice] = useState(centsToInput(user.customMonthlyPriceCents));
  const [expires, setExpires] = useState(user.expiresAt ? user.expiresAt.slice(0, 10) : '');
  const [notes, setNotes] = useState(user.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = plans.find((p) => p.code === planCode);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await AdminService.updateSubscription(user.userId, {
        planCode,
        status,
        customMonthlyPriceCents: inputToCents(price),
        expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
        notes,
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar.');
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Ajustar assinatura" subtitle={`${user.name || user.email} · ${user.email}`}>
      <div className="space-y-4">
        <div className="form-group">
          <label>Plano</label>
          <select className="form-select" value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} — {formatBRL(p.monthlyPriceCents)}/mês{p.active ? '' : ' (inativo)'}
              </option>
            ))}
          </select>
          {plan && plan.benefits.length > 0 && <small className="text-muted">{plan.benefits.join(' · ')}</small>}
        </div>
        <div className="form-group">
          <label>Situação</label>
          <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Valor mensal negociado (R$)</label>
          <input
            className="form-input"
            inputMode="decimal"
            placeholder={plan ? `Vazio = preço do plano (${formatBRL(plan.monthlyPriceCents)})` : ''}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Vencimento</label>
          <input className="form-input" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Observações internas</label>
          <textarea className="form-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <div className="badge badge-rose">{error}</div>}
        <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !planCode}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

const PlansEditor: React.FC<{
  plans: SubscriptionPlan[];
  users: ManagedUser[];
  onChanged: () => void;
}> = ({ plans, users, onChanged }) => {
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar.');
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="badge badge-rose">{error}</div>}
      {plans.map((p) => (
        <PlanCard key={p.code} plan={p} subscribers={users.filter((u) => u.planCode === p.code).length} onSave={(u) => run(() => AdminService.updatePlan(p.code, u))} />
      ))}
      <div className="glass-card" style={{ padding: '1rem' }}>
        <strong>Novo plano</strong>
        <div className="flex gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
          <input className="form-input" style={{ maxWidth: 160 }} placeholder="Código (ex.: FAMILIA)" value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} />
          <input className="form-input" style={{ maxWidth: 240 }} placeholder="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button
            className="btn btn-primary btn-sm"
            disabled={!newCode || !newName.trim()}
            onClick={() =>
              run(async () => {
                await AdminService.createPlan(newCode, newName.trim(), 0);
                setNewCode('');
                setNewName('');
              })
            }
          >
            <Plus size={14} /> Criar
          </button>
        </div>
      </div>
    </div>
  );
};

const PlanCard: React.FC<{
  plan: SubscriptionPlan;
  subscribers: number;
  onSave: (u: Partial<SubscriptionPlan>) => void;
}> = ({ plan, subscribers, onSave }) => {
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description);
  const [monthly, setMonthly] = useState(centsToInput(plan.monthlyPriceCents));
  const [yearly, setYearly] = useState(centsToInput(plan.yearlyPriceCents));
  const [benefits, setBenefits] = useState(plan.benefits.join('\n'));
  const [maxPlannings, setMaxPlannings] = useState(limitToInput(plan.maxPlannings));
  const [maxShared, setMaxShared] = useState(limitToInput(plan.maxSharedMembers));
  const [forseti, setForseti] = useState(plan.forsetiEnabled);
  const [active, setActive] = useState(plan.active);

  return (
    <div className="glass-card" style={{ padding: '1rem' }}>
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <strong>
          {plan.code} {plan.isDefault && <span className="badge badge-cyan">padrão dos novos usuários</span>}
        </strong>
        <small className="text-muted">{subscribers} usuário(s)</small>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
        <div className="form-group"><label>Nome</label><input className="form-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="form-group"><label>Mensal (R$)</label><input className="form-input" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></div>
        <div className="form-group"><label>Anual (R$)</label><input className="form-input" inputMode="decimal" placeholder="Sem plano anual" value={yearly} onChange={(e) => setYearly(e.target.value)} /></div>
        <div className="form-group"><label>Máx. planejamentos</label><input className="form-input" inputMode="numeric" placeholder="Sem limite" value={maxPlannings} onChange={(e) => setMaxPlannings(e.target.value)} /></div>
        <div className="form-group"><label>Máx. pessoas compartilhadas</label><input className="form-input" inputMode="numeric" placeholder="Sem limite" value={maxShared} onChange={(e) => setMaxShared(e.target.value)} /></div>
      </div>
      <div className="form-group"><label>Descrição</label><input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="form-group"><label>Benefícios (um por linha)</label><textarea className="form-input" rows={4} value={benefits} onChange={(e) => setBenefits(e.target.value)} /></div>
      <div className="flex gap-4" style={{ alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div className="flex gap-4">
          <label><input type="checkbox" checked={forseti} onChange={(e) => setForseti(e.target.checked)} /> Forseti liberada</label>
          <label><input type="checkbox" checked={active} disabled={plan.isDefault} onChange={(e) => setActive(e.target.checked)} /> Plano ativo</label>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() =>
            onSave({
              name: name.trim() || plan.name,
              description: description.trim(),
              monthlyPriceCents: inputToCents(monthly) ?? 0,
              yearlyPriceCents: inputToCents(yearly),
              benefits: benefits.split('\n').map((b) => b.trim()).filter(Boolean),
              maxPlannings: inputToLimit(maxPlannings),
              maxSharedMembers: inputToLimit(maxShared),
              forsetiEnabled: forseti,
              active,
            })
          }
        >
          Salvar plano
        </button>
      </div>
    </div>
  );
};
