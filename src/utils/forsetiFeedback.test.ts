import { describe, expect, it } from 'vitest';
import { CHIP_FEEDBACK, checkFeedbackText, feedbackKindFrom, inlineFeedbackText, isFeedbackRequest } from './forsetiFeedback';
import { normalizeReferralCode } from './referral';

describe('isFeedbackRequest', () => {
  it.each([
    'quero dar um feedback',
    'Tenho uma sugestão para o Balder',
    'encontrei um erro no app',
    'quero fazer uma reclamação',
    'quero falar com o time',
    CHIP_FEEDBACK,
  ])('reconhece "%s"', (t) => expect(isFeedbackRequest(t)).toBe(true));

  it.each(['paguei 50 no mercado', 'qual meu saldo hoje?', 'quanto gastei este mês', 'lembra que eu evito parcelar'])(
    'ignora "%s"',
    (t) => expect(isFeedbackRequest(t)).toBe(false)
  );
});

describe('feedbackKindFrom', () => {
  it('entende o tipo por palavras e pelo chip', () => {
    expect(feedbackKindFrom('tenho uma sugestão')).toBe('SUGESTAO');
    expect(feedbackKindFrom('deu um erro na tela')).toBe('PROBLEMA');
    expect(feedbackKindFrom('👏 Elogio')).toBe('ELOGIO');
    expect(feedbackKindFrom('💬 Outro assunto')).toBe('OUTRO');
    expect(feedbackKindFrom('bom dia')).toBeNull();
  });
});

describe('inlineFeedbackText', () => {
  it('pega o que vem depois dos dois-pontos', () => {
    expect(inlineFeedbackText('tenho uma sugestão: coloque um gráfico de metas na tela inicial')).toBe('coloque um gráfico de metas na tela inicial');
    expect(inlineFeedbackText('tenho uma sugestão')).toBe('');
    expect(inlineFeedbackText('sugestão: ok')).toBe('');
  });
});

describe('checkFeedbackText', () => {
  it('exige um texto minimamente descritivo', () => {
    expect(checkFeedbackText('legal')).toEqual({ ok: false, reason: 'CURTO' });
    expect(checkFeedbackText('  Gostei muito do   painel de metas  ')).toEqual({ ok: true, text: 'Gostei muito do painel de metas' });
  });
  it('recusa e-mail, link e número longo', () => {
    expect(checkFeedbackText('me responda em fulano@gmail.com por favor')).toEqual({ ok: false, reason: 'SENSIVEL' });
    expect(checkFeedbackText('veja https://exemplo.com/print.png do erro')).toEqual({ ok: false, reason: 'SENSIVEL' });
    expect(checkFeedbackText('meu cpf 12345678901 aparece errado')).toEqual({ ok: false, reason: 'SENSIVEL' });
  });
});

describe('normalizeReferralCode', () => {
  it('aceita só códigos alfanuméricos de 6 a 16 caracteres', () => {
    expect(normalizeReferralCode(' AB12cd34 ')).toBe('ab12cd34');
    expect(normalizeReferralCode('abc')).toBe('');
    expect(normalizeReferralCode('a b c d e f')).toBe('');
    expect(normalizeReferralCode(null)).toBe('');
  });
});
