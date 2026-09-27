import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type ShareRole = 'COLABORADOR' | 'VISUALIZADOR';
export type ShareScope = 'CONTA' | 'PLANEJAMENTO';
export type ShareStatus = 'PENDENTE' | 'ATIVO' | 'REVOGADO';

export interface AccountShare {
  id: string;
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  inviteToken: string;
  invitedEmail?: string;
  memberId?: string;
  memberName?: string;
  memberEmail?: string;
  role: ShareRole;
  scope: ShareScope;
  status: ShareStatus;
  createdAt: string;
  acceptedAt?: string;
  revokedAt?: string;
}

export interface InvitePreview {
  ownerName?: string;
  ownerEmail?: string;
  role: ShareRole;
  scope: ShareScope;
  status: ShareStatus;
  invitedEmail?: string;
}

export const ROLE_LABEL: Record<ShareRole, string> = {
  COLABORADOR: 'Colaborador (registra pagamentos)',
  VISUALIZADOR: 'Visualizador (só vê)',
};

export const SCOPE_LABEL: Record<ShareScope, string> = {
  CONTA: 'Conta inteira',
  PLANEJAMENTO: 'Só o planejamento compartilhado',
};

const mapShare = (row: Record<string, unknown>): AccountShare => ({
  id: String(row.id),
  ownerId: String(row.owner_id),
  ownerName: (row.owner_name as string) || undefined,
  ownerEmail: (row.owner_email as string) || undefined,
  inviteToken: String(row.invite_token),
  invitedEmail: (row.invited_email as string) || undefined,
  memberId: (row.member_id as string) || undefined,
  memberName: (row.member_name as string) || undefined,
  memberEmail: (row.member_email as string) || undefined,
  role: row.role as ShareRole,
  scope: row.scope as ShareScope,
  status: row.status as ShareStatus,
  createdAt: String(row.created_at),
  acceptedAt: (row.accepted_at as string) || undefined,
  revokedAt: (row.revoked_at as string) || undefined,
});

/** Mensagem legível dos erros do Supabase (inclusive das exceções das funções SQL). */
const errorMessage = (error: { message?: string } | null, fallback: string) => {
  const msg = error?.message || '';
  if (/relation .*account_shares|function .*does not exist|schema cache/i.test(msg)) {
    return 'O compartilhamento ainda não foi ativado no banco. Rode o script supabase/sharing.sql no Supabase.';
  }
  return msg || fallback;
};

export const inviteLink = (token: string) => `${window.location.origin}/#convite=${token}`;

export const SharingService = {
  /** Acessos que eu concedi (como dono). */
  async listMyShares(): Promise<AccountShare[]> {
    if (!isSupabaseConfigured) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('account_shares')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(errorMessage(error, 'Não foi possível carregar os compartilhamentos.'));
    return (data || []).map(mapShare);
  },

  /** Contas compartilhadas comigo (ativas) e convites pendentes enviados para o meu e-mail. */
  async listSharedWithMe(): Promise<AccountShare[]> {
    if (!isSupabaseConfigured) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('account_shares')
      .select('*')
      .neq('owner_id', user.id)
      .in('status', ['ATIVO', 'PENDENTE'])
      .order('created_at', { ascending: false });
    if (error) throw new Error(errorMessage(error, 'Não foi possível carregar as contas compartilhadas.'));
    return (data || []).map(mapShare);
  },

  async createInvite(params: { role: ShareRole; scope: ShareScope; invitedEmail?: string; ownerName?: string; ownerEmail?: string }): Promise<AccountShare> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Entre na sua conta para compartilhar.');
    const { data, error } = await supabase
      .from('account_shares')
      .insert({
        owner_id: user.id,
        owner_name: params.ownerName || null,
        owner_email: params.ownerEmail || user.email || null,
        invited_email: params.invitedEmail?.trim().toLowerCase() || null,
        role: params.role,
        scope: params.scope,
      })
      .select('*')
      .single();
    if (error || !data) throw new Error(errorMessage(error, 'Não foi possível criar o convite.'));
    return mapShare(data);
  },

  async updateShare(id: string, updates: { role?: ShareRole; scope?: ShareScope }): Promise<void> {
    const { error } = await supabase.from('account_shares').update(updates).eq('id', id);
    if (error) throw new Error(errorMessage(error, 'Não foi possível alterar o acesso.'));
  },

  /** Dono revoga: o acesso é cortado na hora (as regras do banco checam o status). */
  async revoke(id: string): Promise<void> {
    const { error } = await supabase
      .from('account_shares')
      .update({ status: 'REVOGADO', revoked_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(errorMessage(error, 'Não foi possível revogar o acesso.'));
  },

  /** Dono apaga um convite revogado ou pendente da lista. */
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('account_shares').delete().eq('id', id);
    if (error) throw new Error(errorMessage(error, 'Não foi possível remover o convite.'));
  },

  async previewInvite(token: string): Promise<InvitePreview | null> {
    const { data, error } = await supabase.rpc('get_account_invite', { p_token: token });
    if (error) throw new Error(errorMessage(error, 'Não foi possível ler o convite.'));
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      ownerName: row.owner_name || undefined,
      ownerEmail: row.owner_email || undefined,
      role: row.role,
      scope: row.scope,
      status: row.status,
      invitedEmail: row.invited_email || undefined,
    };
  },

  async acceptInvite(token: string): Promise<AccountShare> {
    const { data, error } = await supabase.rpc('accept_account_invite', { p_token: token });
    if (error || !data) throw new Error(errorMessage(error, 'Não foi possível aceitar o convite.'));
    return mapShare((Array.isArray(data) ? data[0] : data) as Record<string, unknown>);
  },

  /** Convidado deixa de acessar a conta. */
  async leave(id: string): Promise<void> {
    const { error } = await supabase.rpc('leave_account_share', { p_share_id: id });
    if (error) throw new Error(errorMessage(error, 'Não foi possível sair da conta compartilhada.'));
  },

  /** Situação atual de um acesso (para cortar a visualização assim que for revogado). */
  async getShareStatus(id: string): Promise<AccountShare | null> {
    const { data, error } = await supabase.from('account_shares').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return mapShare(data);
  },
};
