import type { DoubtId } from './forsetiAssistant';

/**
 * Conjunto de avaliação da Forseti: frases reais (sem números) e a intenção que as regras devem reconhecer.
 * É a rede de proteção para mexer em detectDoubt: qualquer refatoração ou regra nova precisa manter tudo isto verde.
 * Fonte única: forsetiEval.test.ts roda estes casos; os relatórios do cron (ForsetiLearningReview) viram linhas aqui.
 */
export interface DoubtCase {
  text: string;
  /** null = não é dúvida (registro, conversa solta ou assunto que outra camada trata). */
  expected: DoubtId | null;
}

const group = (expected: DoubtId | null, texts: string[]): DoubtCase[] => texts.map((text) => ({ text, expected }));

/** O que as regras reconhecem hoje e não pode piorar. */
export const DOUBT_CASES: DoubtCase[] = [
  ...group('BOM_DIA', ['bom dia', 'resumo do dia']),
  ...group('MEMORIAS', ['o que você sabe sobre mim', 'minhas memórias']),
  ...group('MENU', ['tenho uma dúvida', 'dúvida', 'outra dúvida']),
  ...group('SALDO_HOJE', ['qual meu saldo hoje?', 'saldo', 'quanto eu tenho', 'saldo atual', 'quanto tenho na conta', 'meu saldo', 'saldo em conta']),
  ...group('PROXIMO_RECEB', [
    'quando entra meu próximo recebimento?', 'quando recebo meu salário', 'quando cai o salário', 'próxima entrada', 'quando vou receber',
  ]),
  ...group('SOBRA', ['quanto ainda posso gastar este mês?', 'quanto posso gastar', 'quanto sobra esse mês', 'sobrou quanto', 'livre para gastar']),
  ...group('VENCE', [
    'o que vence nos próximos dias?', 'contas atrasadas', 'o que vence essa semana', 'vencimentos', 'próximos dias', 'contas em atraso',
    'tem alguma conta vencendo',
  ]),
  ...group('GASTEI', ['quanto já gastei este mês?', 'quanto gastei', 'meus gastos', 'gastos deste mês', 'gastei esse mês', 'gastos do mês']),
  ...group('GASTOS_PERIODO', [
    'gastos desta semana', 'gastos de hoje', 'quanto gastei hoje', 'despesas da quinzena', 'gastos da semana', 'quanto saiu essa semana',
    'gastos por natureza', 'quanto gastei por categoria', 'gastos por natureza esse mês',
  ]),
  ...group('GASTOS_DETALHE', ['gastos com mercado em setembro', 'quanto gastei com uber', 'gastos com mercado', 'gastei com ifood no mês passado']),
  ...group('CAIU', ['por que meu saldo previsto caiu?', 'por que o saldo caiu', 'porque meu saldo está negativo', 'por que diminuiu']),
  ...group('RESERVA', ['como está minha reserva de emergência', 'reserva de emergência', 'minha reserva']),
  ...group('METAS', ['minhas metas', 'metas', 'qual a minha meta', 'metas financeiras']),
  ...group('QUITAR', ['vale a pena quitar meu empréstimo?', 'quitar empréstimo', 'antecipar parcelas', 'amortizar', 'vale quitar']),
  ...group('COMPRA', [
    'posso comprar um carro?', 'posso comprar uma moto', 'dá pra comprar um celular', 'consigo comprar uma casa', 'financiar um carro',
    'vale a pena comprar um notebook',
  ]),
  ...group('COMO_FUNCIONA', ['como funciona?', 'o que você faz', 'me ajuda', 'ajuda', 'como usar o app']),
  ...group('GLOSSARIO', ['o que é natureza?', 'o que é competência', 'o que significa mapeamento', 'o que são naturezas']),
  ...group('ONDE_VER', ['onde vejo meus contratos', 'onde fica a fatura', 'ver contratos']),
  ...group('ULTIMAS', ['quais minhas últimas compras', 'últimas saídas', 'compras recentes', 'o que comprei recentemente', 'últimos lançamentos']),
  ...group('PREVISTO_REAL', ['o que foi previsto e não foi pago', 'previsto e não registrado', 'gastei menos que o previsto', 'o que eu previ e não paguei']),
  ...group('SEM_NATUREZA', [
    'o que tem dentro de Outros?', 'o que tem em outros', 'o que é esse gasto da natureza Outros', 'sem natureza', 'gastos sem categoria',
  ]),
  // Não são dúvida: registro, conversa solta ou assunto de outra camada (ambiguidade de cartão, por exemplo)
  ...group(null, [
    'bom dia, paguei 50 na farmácia', 'gastei 50 no ifood ontem', 'gastei cem reais no mercado em setembro', 'previ 50 de gasolina', 'paguei 50 na farmácia', '30 mercado', 'recebi 1000', 'obrigado', 'oi', 'fatura do cartão',
  ]),
  // Preferência, prioridade, restrição e conversa fora do tema: seguem para a IA (memória), sem cair numa palavra solta
  ...group(null, [
    'eu odeio parcelar compras', 'meu foco esse ano e quitar o emprestimo antes de investir', 'nao quero mexer na minha reserva de jeito nenhum',
    'quem ganhou o jogo ontem',
  ]),
];

/** Casos vindos dos relatórios de aprendizado: cole aqui as linhas geradas pelo painel (`['frase', 'INTENCAO'],`). */
export const REPORT_CASES: [string, DoubtId][] = [];

/**
 * Lacunas conhecidas: frases que as regras ainda erram. O teste espera que continuem falhando; quando uma regra passar a
 * acertar, o teste avisa e a frase sobe para DOUBT_CASES.
 */
export const KNOWN_GAPS: DoubtCase[] = [];
