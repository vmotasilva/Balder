import { stripAccents } from './forsetiMoney';

/**
 * Feedback da pessoa para os gestores do Balder, conduzido pela Forseti no chat.
 * Só segue depois do "Confirmar" e nunca leva e-mail, link ou número de documento/conta escrito no texto.
 */

export const FEEDBACK_KINDS = ['SUGESTAO', 'PROBLEMA', 'ELOGIO', 'OUTRO'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = {
  SUGESTAO: 'Sugestão',
  PROBLEMA: 'Problema',
  ELOGIO: 'Elogio',
  OUTRO: 'Outro assunto',
};

export const FEEDBACK_KIND_CHIP: Record<FeedbackKind, string> = {
  SUGESTAO: '💡 Sugestão',
  PROBLEMA: '🐞 Problema',
  ELOGIO: '👏 Elogio',
  OUTRO: '💬 Outro assunto',
};

export const CHIP_FEEDBACK = '💬 Dar um feedback';

export const FEEDBACK_MIN = 10;
export const FEEDBACK_MAX = 1000;

export const isFeedbackKind = (v: unknown): v is FeedbackKind => FEEDBACK_KINDS.includes(v as FeedbackKind);

/** Escolha do tipo, pelo chip ou por palavras ("sugestão", "deu erro", "gostei"). */
export function feedbackKindFrom(text: string): FeedbackKind | null {
  const t = stripAccents(text.toLowerCase());
  const chip = FEEDBACK_KINDS.find((k) => stripAccents(FEEDBACK_KIND_CHIP[k].toLowerCase()) === t);
  if (chip) return chip;
  if (/sugest|ideia|melhoria|poderia|deveria/.test(t)) return 'SUGESTAO';
  if (/problema|erro|bug|falha|travou|nao funciona|reclama|critica/.test(t)) return 'PROBLEMA';
  if (/elogio|gostei|parabens|adorei|amei/.test(t)) return 'ELOGIO';
  if (/outro|outra/.test(t)) return 'OUTRO';
  return null;
}

/** A pessoa quer dar um feedback / sugestão / reclamação ao time do Balder (e não registrar ou perguntar algo). */
export function isFeedbackRequest(text: string): boolean {
  const t = stripAccents(text.toLowerCase()).replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (t === stripAccents(CHIP_FEEDBACK.toLowerCase())) return true;
  return (
    /\bfeedback\b/.test(t) ||
    /(quero|queria|gostaria de|posso|vou|deixa eu|preciso) (dar|deixar|fazer|enviar|mandar|registrar|passar) (uma |um )?(sugestao|critica|reclamacao|elogio|ideia|melhoria)/.test(t) ||
    /(tenho|tinha) (uma |um )?(sugestao|ideia|critica|reclamacao|elogio) (para|pra|pro|sobre) (o |a )?(balder|app|aplicativo|sistema|forseti|voces)/.test(t) ||
    /(encontrei|achei|percebi|notei|deu|dando|tem) (um |uma )?(erro|bug|problema) (no|na|nos|nas|do|da) (balder|app|aplicativo|sistema|forseti)/.test(t) ||
    /(sugestao|sugerir|reclamar|elogiar) (para|pra|ao|aos|do|da|de) (o |a )?(time|equipe|gestor|gestores|desenvolvedor|desenvolvedores|balder)/.test(t) ||
    /falar com (o |a )?(time|equipe|gestor|gestores|desenvolvedor|desenvolvedores|suporte)/.test(t)
  );
}

/** Conteúdo já escrito junto com o pedido ("tenho uma sugestão: coloque um gráfico de metas"): o que vem depois dos dois-pontos. */
export function inlineFeedbackText(text: string): string {
  const i = text.indexOf(':');
  if (i < 0) return '';
  const body = text.slice(i + 1).replace(/\s+/g, ' ').trim();
  return body.length >= FEEDBACK_MIN ? body : '';
}

/** E-mail, link ou número longo (CPF, conta, cartão, telefone): não vai nos feedbacks. */
const SENSITIVE = [/\S+@\S+\.\S+/, /https?:\/\/|www\./i, /\d{9,}/, /\d{3}\.\d{3}\.\d{3}-\d{2}/, /(?:\d[ .-]?){12,}/];
export const feedbackHasSensitiveData = (text: string) => SENSITIVE.some((re) => re.test(text));

export type FeedbackCheck = { ok: true; text: string } | { ok: false; reason: 'CURTO' | 'SENSIVEL' };

export function checkFeedbackText(raw: string): FeedbackCheck {
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, FEEDBACK_MAX);
  if (text.length < FEEDBACK_MIN) return { ok: false, reason: 'CURTO' };
  if (feedbackHasSensitiveData(text)) return { ok: false, reason: 'SENSIVEL' };
  return { ok: true, text };
}

export const FEEDBACK_STATUSES = ['NOVO', 'EM_ANALISE', 'IMPLEMENTADO', 'DESCARTADO'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  NOVO: 'Novo',
  EM_ANALISE: 'Em análise',
  IMPLEMENTADO: 'Implementado',
  DESCARTADO: 'Descartado',
};
