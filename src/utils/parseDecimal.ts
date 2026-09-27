/**
 * Leitura de números digitados pelo usuário aceitando vírgula OU ponto como separador decimal.
 *
 * Regras (comuns às duas funções):
 * - "R$", "%", espaços e letras são ignorados; um "-" em qualquer posição torna o número negativo.
 * - Com os dois separadores, o que aparece por último é o decimal e o outro é milhar
 *   ("1.234,56" e "1,234.56" → 1234.56).
 * - Um separador repetido é sempre milhar ("1.234.567" → 1234567).
 * - Um separador único é decimal ("12,5" e "12.5" → 12.5; "10," → 10).
 *
 * parseMoney acrescenta a convenção brasileira para o único caso ambíguo: ponto único seguido de
 * exatamente 3 dígitos é milhar ("1.500" → 1500), enquanto "1,500" continua sendo 1,5.
 */

const readNumber = (input: string | number | null | undefined, dotThousandsHint: boolean): number => {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (input === null || input === undefined) return 0;

  const raw = String(input);
  const negative = raw.includes('-');
  const s = raw.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return 0;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let decimalSep: '.' | ',' | null = null;

  if (lastDot >= 0 && lastComma >= 0) {
    decimalSep = lastDot > lastComma ? '.' : ',';
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = s.split(sep);
    if (parts.length === 2) {
      const [intPart, fracPart] = parts;
      const looksLikeThousands = dotThousandsHint && sep === '.' && fracPart.length === 3 && /[1-9]/.test(intPart);
      decimalSep = looksLikeThousands ? null : sep;
    }
  }

  let normalized: string;
  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    normalized = `${s.slice(0, idx).replace(/[.,]/g, '')}.${s.slice(idx + 1).replace(/[.,]/g, '')}`;
  } else {
    normalized = s.replace(/[.,]/g, '');
  }

  const value = parseFloat(normalized);
  if (!Number.isFinite(value)) return 0;
  return negative ? -value : value;
};

/** Taxas, quantidades e demais números: separador único é sempre decimal ("1.125" → 1,125). */
export const parseDecimal = (input: string | number | null | undefined): number => readNumber(input, false);

/** Valores em reais: como parseDecimal, mas "1.500" é lido como mil e quinhentos. */
export const parseMoney = (input: string | number | null | undefined): number => readNumber(input, true);

/**
 * Formata um número para edição em campo de texto, no padrão pt-BR, de forma que parseMoney/parseDecimal
 * leia de volta o mesmo valor. Valores em reais usam milhar e duas casas quando há centavos.
 */
export const formatDecimalInput = (value: number, options: { money?: boolean; maxFractionDigits?: number } = {}): string => {
  if (!Number.isFinite(value)) return '';
  const { money = true, maxFractionDigits = money ? 2 : 4 } = options;
  if (money) {
    const hasCents = Math.round(value * 100) % 100 !== 0;
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: Math.max(2, maxFractionDigits),
    });
  }
  return value.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: maxFractionDigits });
};
