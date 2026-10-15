/**
 * "Pular" na configuração conversada com a Forseti: cada pergunta pulada usa um padrão seguro e, no fim do assunto,
 * a Forseti diz quantas pulou, para a pessoa saber o que foi decidido por ela e poder ajustar depois.
 */

/** Pergunta pulada, com a posição dela na sequência do assunto (para desfazer se a pessoa voltar). */
export interface SkipMark {
  question: string;
  depth: number;
}

/** Acrescenta ao resumo do assunto o aviso das perguntas puladas; sem nenhuma, o resumo fica como está. */
export function withSkipNote(summary: string, skipped: number): string {
  if (skipped <= 0) return summary;
  const note = skipped === 1 ? 'Pulei 1 pergunta e usei o padrão' : `Pulei ${skipped} perguntas e usei os padrões`;
  return `${summary} ${note}: dá para ajustar depois.`;
}

/** Ao voltar para uma pergunta, a marca de pulo dela (e das seguintes) deixa de valer. */
export const marksAfterBack = (marks: SkipMark[], newDepth: number): SkipMark[] => marks.filter((m) => m.depth < newDepth);

/** Resumo de um assunto pulado por inteiro: nada foi alterado. */
export const skippedTopicSummary = (topicLabel: string): string =>
  `Pulei ${topicLabel.toLowerCase()}: nada foi alterado, e dá para voltar a esse assunto quando quiser.`;
