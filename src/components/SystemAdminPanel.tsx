import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Search, Users, Wallet, Crown, FlaskConical, Plus, Activity } from 'lucide-react';
import { Modal } from './Modal';
import { ForsetiLearningReview } from './ForsetiLearningReview';
import {
  AdminService,
  ENGAGEMENT_LABEL,
  STATUS_LABEL,
  contributionScore,
  effectiveMonthlyCents,
  engagementLevel,
  formatBRL,
  setupCount,
  type EngagementLevel,
  type ManagedUser,
  type UserMetrics,
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

const ENGAGEMENT_BADGE: Record<EngagementLevel, string> = {
  MUITO_ATIVO: 'badge-emerald',
  ATIVO: 'badge-cyan',
  POUCO_ATIVO: 'badge-amber',
  INATIVO: 'badge-rose',
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
  const [metrics, setMetrics] = useState<Map<string, UserMetrics>>(new Map());
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [tab, setTab] = useState<'USUARIOS' | 'ENGAJAMENTO' | 'PLANOS' | 'APRENDIZADO'>('USUARIOS');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | ''>('');
  const [editing, setEditing] = useState<ManagedUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, u] = await Promise.all([AdminService.listPlans(), AdminService.listUsers()]);
      setPlans(p);
      setUsers(u);
      try {
        const m = await AdminService.listMetrics();
        setMetrics(new Map(m.map((x) => [x.userId, x])));
        setMetricsError(null);
      } catch (e: any) {
        setMetricsError(e?.message || 'Falha ao carregar as métricas.');
      }
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
    return users.filter(
      (u) =>
        (!q || `${u.name} ${u.email}`.toLowerCase().includes(q)) &&
        (!planFilter || (planFilter === '__NONE__' ? !u.planCode : u.planCode === planFilter)) &&
        (!statusFilter || u.status === statusFilter)
    );
  }, [users, search, planFilter, statusFilter]);

  const planName = (code: string | null) => plans.find((p) => p.code === code)?.name || code || '—';

  const filtersEl = (
    <UserFilters
      search={search}
      onSearch={setSearch}
      planFilter={planFilter}
      onPlan={setPlanFilter}
      statusFilter={statusFilter}
      onStatus={setStatusFilter}
      plans={plans}
      users={users}
      shown={filtered.length}
    />
  );

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
        <button className={`btn btn-sm ${tab === 'ENGAJAMENTO' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('ENGAJAMENTO')}>
          Engajamento
        </button>
        <button className={`btn btn-sm ${tab === 'PLANOS' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('PLANOS')}>
          Planos ({plans.length})
        </button>
        <button className={`btn btn-sm ${tab === 'APRENDIZADO' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('APRENDIZADO')}>
          Aprendizado da Forseti
        </button>
      </div>

      {tab === 'APRENDIZADO' && <ForsetiLearningReview />}

      {loading && tab !== 'APRENDIZADO' && <p className="text-muted">Carregando…</p>}

      {!loading && tab === 'USUARIOS' && (
        <div className="space-y-3">
          {filtersEl}
          <div className="admin-users-table-wrap">
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

          {/* Mobile: cada usuário vira um card */}
          <div className="admin-user-cards">
            {filtered.map((u) => (
              <div key={u.userId} className="admin-user-card">
                <div className="admin-user-card-head">
                  <div className="admin-user-card-id">
                    <strong>{u.name || u.email.split('@')[0]}</strong>
                    {u.systemRole !== 'USUARIO' && <span className="badge badge-purple">{u.systemRole}</span>}
                    <small className="text-muted">{u.email}</small>
                  </div>
                  <button className="btn btn-outline btn-xs" onClick={() => setEditing(u)} title="Ajustar assinatura" aria-label="Ajustar assinatura">
                    <Pencil size={13} />
                  </button>
                </div>
                <div className="admin-user-card-grid">
                  <div>
                    <span>Plano</span>
                    <strong>{planName(u.planCode)}</strong>
                  </div>
                  <div>
                    <span>Situação</span>
                    <span className={`badge ${STATUS_BADGE[u.status]}`}>{STATUS_LABEL[u.status]}</span>
                  </div>
                  <div>
                    <span>Mensal{u.customMonthlyPriceCents !== null ? ' (negociado)' : ''}</span>
                    <strong>{formatBRL(effectiveMonthlyCents(u, plans))}</strong>
                  </div>
                  <div>
                    <span>Vencimento</span>
                    <strong>{fmtDate(u.expiresAt)}</strong>
                  </div>
                  <div>
                    <span>Cadastro</span>
                    <strong>{fmtDate(u.createdAt)}</strong>
                  </div>
                  <div>
                    <span>Último acesso</span>
                    <strong>{fmtDate(u.lastSignInAt)}</strong>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-muted">Nenhum usuário encontrado.</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'ENGAJAMENTO' && (
        <EngagementPanel users={users} plans={plans} metrics={metrics} metricsError={metricsError} filtered={filtered} filters={filtersEl} />
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

const UserFilters: React.FC<{
  search: string;
  onSearch: (v: string) => void;
  planFilter: string;
  onPlan: (v: string) => void;
  statusFilter: SubscriptionStatus | '';
  onStatus: (v: SubscriptionStatus | '') => void;
  plans: SubscriptionPlan[];
  users: ManagedUser[];
  shown: number;
}> = ({ search, onSearch, planFilter, onPlan, statusFilter, onStatus, plans, users, shown }) => {
  const count = (fn: (u: ManagedUser) => boolean) => users.filter(fn).length;
  const withoutPlan = count((u) => !u.planCode);
  const filtering = !!(search || planFilter || statusFilter);
  return (
    <div className="space-y-2">
      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 12, opacity: 0.6 }} />
          <input
            className="form-input"
            style={{ paddingLeft: 30 }}
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <select className="form-select" style={{ flex: '0 1 200px' }} value={planFilter} onChange={(e) => onPlan(e.target.value)} aria-label="Filtrar por plano">
          <option value="">Todos os planos</option>
          {plans.map((p) => (
            <option key={p.code} value={p.code}>{p.name} ({count((u) => u.planCode === p.code)})</option>
          ))}
          {withoutPlan > 0 && <option value="__NONE__">Sem plano ({withoutPlan})</option>}
        </select>
        <select className="form-select" style={{ flex: '0 1 180px' }} value={statusFilter} onChange={(e) => onStatus(e.target.value as SubscriptionStatus | '')} aria-label="Filtrar por situação">
          <option value="">Todas as situações</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]} ({count((u) => u.status === s)})</option>
          ))}
        </select>
        {filtering && (
          <button className="btn btn-outline btn-sm" onClick={() => { onSearch(''); onPlan(''); onStatus(''); }}>
            Limpar
          </button>
        )}
      </div>
      <small className="text-muted">{shown} de {users.length} usuário(s)</small>
    </div>
  );
};

type SortKey = 'SCORE' | 'RECENT' | 'MOVEMENTS' | 'DAYS' | 'FORSETI';

const EngagementPanel: React.FC<{
  users: ManagedUser[];
  plans: SubscriptionPlan[];
  metrics: Map<string, UserMetrics>;
  metricsError: string | null;
  filtered: ManagedUser[];
  filters: React.ReactNode;
}> = ({ users, plans, metrics, metricsError, filtered, filters }) => {
  const [sort, setSort] = useState<SortKey>('SCORE');
  const now = Date.now();

  const summary = useMemo(() => {
    const levels: Record<EngagementLevel, number> = { MUITO_ATIVO: 0, ATIVO: 0, POUCO_ATIVO: 0, INATIVO: 0 };
    let movements = 0;
    let forseti = 0;
    for (const u of users) {
      const m = metrics.get(u.userId);
      levels[engagementLevel(m)] += 1;
      movements += m?.movementsTotal ?? 0;
      forseti += m?.forsetiActions ?? 0;
    }
    return { levels, movements, forseti };
  }, [users, metrics]);

  const rows = useMemo(() => {
    const key = (u: ManagedUser) => {
      const m = metrics.get(u.userId);
      if (!m) return 0;
      switch (sort) {
        case 'RECENT': return m.lastActivityAt ? new Date(m.lastActivityAt).getTime() : 0;
        case 'MOVEMENTS': return m.movementsTotal;
        case 'DAYS': return m.activeDays30d;
        case 'FORSETI': return m.forsetiActions;
        default: return contributionScore(m);
      }
    };
    return [...filtered].sort((a, b) => key(b) - key(a));
  }, [filtered, metrics, sort]);

  const planName = (code: string | null) => plans.find((p) => p.code === code)?.name || code || '—';
  const ago = (iso: string | null) => {
    if (!iso) return 'nunca';
    const d = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
    return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`;
  };

  return (
    <div className="space-y-4">
      {metricsError && <div className="badge badge-rose">{metricsError}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
        {(Object.keys(ENGAGEMENT_LABEL) as EngagementLevel[]).map((l) => (
          <div key={l} className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">{ENGAGEMENT_LABEL[l]}</span>
              <Activity size={16} />
            </div>
            <div className="stat-card-value">{summary.levels[l]}</div>
          </div>
        ))}
        <div className="stat-card">
          <div className="stat-card-header"><span className="stat-card-label">Lançamentos</span></div>
          <div className="stat-card-value">{summary.movements}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header"><span className="stat-card-label">Ações da Forseti</span></div>
          <div className="stat-card-value">{summary.forseti}</div>
        </div>
      </div>

      {filters}

      <div className="flex gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="text-muted" htmlFor="admin-sort">Ordenar por</label>
        <select id="admin-sort" className="form-select" style={{ maxWidth: 240 }} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="SCORE">Contribuição (pontos)</option>
          <option value="RECENT">Atividade mais recente</option>
          <option value="MOVEMENTS">Lançamentos</option>
          <option value="DAYS">Dias ativos (30d)</option>
          <option value="FORSETI">Uso da Forseti</option>
        </select>
      </div>

      <div className="admin-users-table-wrap" style={{ display: 'block', overflowX: 'auto' }}>
        <table className="movements-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Nível</th>
              <th>Pontos</th>
              <th>Lançamentos (30d)</th>
              <th>Dias ativos (30d)</th>
              <th title="Contas, naturezas, metas, contratos e meios de pagamento">Cadastros</th>
              <th title="Ações · úteis · não úteis">Forseti</th>
              <th title="Memórias / conversas salvas">Memórias/Chats</th>
              <th>Convites</th>
              <th>Última atividade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const m = metrics.get(u.userId);
              const level = engagementLevel(m);
              return (
                <tr key={u.userId}>
                  <td>
                    <strong>{u.name || u.email.split('@')[0]}</strong>
                    <br />
                    <small className="text-muted">{u.email} · {planName(u.planCode)}</small>
                  </td>
                  <td><span className={`badge ${ENGAGEMENT_BADGE[level]}`}>{ENGAGEMENT_LABEL[level]}</span></td>
                  <td><strong>{m ? contributionScore(m) : 0}</strong></td>
                  <td>{m ? `${m.movements30d} (${m.movementsTotal} no total)` : '—'}</td>
                  <td>{m?.activeDays30d ?? '—'}</td>
                  <td>{m ? setupCount(m) : '—'}</td>
                  <td>{m ? `${m.forsetiActions} · ${m.forsetiUseful} úteis · ${m.forsetiNotUseful} não` : '—'}</td>
                  <td>{m ? `${m.forsetiMemories} / ${m.forsetiChats}` : '—'}</td>
                  <td>{m?.sharesSent ?? '—'}</td>
                  <td>{ago(m?.lastActivityAt ?? null)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={10} className="text-muted">Nenhum usuário encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
      <small className="text-muted">
        Pontos = lançamentos (até 100) + 5 por dia ativo + 5 por avaliação da Forseti + 2 por ação da Forseti + 3 por memória
        + 2 por cadastro/preço monitorado + 3 por convite. Inativo = sem atividade há mais de 14 dias.
      </small>
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
      <div className="glass-card admin-plan-card">
        <strong>Novo plano</strong>
        <div className="admin-plan-new">
          <input className="form-input" placeholder="Código (ex.: FAMILIA)" value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} />
          <input className="form-input" placeholder="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} />
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
  const [consolidated, setConsolidated] = useState(plan.consolidatedEnabled);
  const [opportunities, setOpportunities] = useState(plan.opportunitiesEnabled);
  const [active, setActive] = useState(plan.active);

  return (
    <div className="glass-card admin-plan-card">
      <div className="admin-plan-head">
        <strong>
          {plan.code} {plan.isDefault && <span className="badge badge-cyan">padrão dos novos usuários</span>}
        </strong>
        <small className="text-muted">{subscribers} usuário(s)</small>
      </div>
      <div className="admin-plan-grid">
        <div className="form-group admin-plan-wide"><label>Nome</label><input className="form-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="form-group"><label>Mensal (R$)</label><input className="form-input" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></div>
        <div className="form-group"><label>Anual (R$)</label><input className="form-input" inputMode="decimal" placeholder="Sem plano anual" value={yearly} onChange={(e) => setYearly(e.target.value)} /></div>
        <div className="form-group admin-plan-wide"><label>Máx. planejamentos (com o principal)</label><input className="form-input" inputMode="numeric" placeholder="Sem limite" value={maxPlannings} onChange={(e) => setMaxPlannings(e.target.value)} /></div>
        <div className="form-group admin-plan-wide"><label>Máx. convites de compartilhamento</label><input className="form-input" inputMode="numeric" placeholder="Sem limite" value={maxShared} onChange={(e) => setMaxShared(e.target.value)} /></div>
      </div>
      <div className="form-group"><label>Descrição</label><input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="form-group"><label>Benefícios (um por linha)</label><textarea className="form-input" rows={4} value={benefits} onChange={(e) => setBenefits(e.target.value)} /></div>
      <div className="admin-plan-footer">
        <div className="admin-plan-checks">
          <label><input type="checkbox" checked={forseti} onChange={(e) => setForseti(e.target.checked)} /> Forseti liberada</label>
          <label><input type="checkbox" checked={consolidated} onChange={(e) => setConsolidated(e.target.checked)} /> Visão consolidada</label>
          <label><input type="checkbox" checked={opportunities} onChange={(e) => setOpportunities(e.target.checked)} /> Oportunidades e preços</label>
          <label><input type="checkbox" checked={active} disabled={plan.isDefault} onChange={(e) => setActive(e.target.checked)} /> Plano ativo</label>
        </div>
        <button
          className="btn btn-primary btn-sm admin-plan-save"
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
              consolidatedEnabled: consolidated,
              opportunitiesEnabled: opportunities,
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
