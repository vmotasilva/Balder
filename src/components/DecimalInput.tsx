import React, { useState } from 'react';
import { formatDecimalInput, parseDecimal, parseMoney } from '../utils/parseDecimal';

type DecimalInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
  /** Valor em reais (padrão). Use false para taxas e quantidades, em que "1.125" é 1,125. */
  money?: boolean;
  maxFractionDigits?: number;
  /** Mostra o campo vazio quando o valor é zero. */
  emptyWhenZero?: boolean;
};

/**
 * Campo numérico que aceita vírgula ou ponto como separador decimal. Guarda o texto digitado para não
 * atrapalhar a digitação ("12," não vira "12") e só reescreve o texto quando o valor muda por fora.
 */
export const DecimalInput: React.FC<DecimalInputProps> = ({
  value,
  onValueChange,
  money = true,
  maxFractionDigits,
  emptyWhenZero = false,
  onBlur,
  ...rest
}) => {
  const parse = money ? parseMoney : parseDecimal;
  const format = (n: number | null | undefined) =>
    n === null || n === undefined || (emptyWhenZero && n === 0) ? '' : formatDecimalInput(n, { money, maxFractionDigits });

  const [text, setText] = useState(() => format(value));
  const [lastValue, setLastValue] = useState(value);

  // Valor alterado por fora (preset, recálculo, reset): reescreve o texto se ele não representa mais o valor
  if (value !== lastValue) {
    setLastValue(value);
    if (parse(text) !== (value ?? 0)) setText(format(value));
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const next = e.target.value.replace(/[^\d.,\-\sR$%]/g, '');
        setText(next);
        onValueChange(parse(next));
      }}
      onBlur={(e) => {
        // Ao sair do campo, mostra o número como foi entendido ("1500.5" → "1.500,50")
        if (text.trim() !== '') setText(format(parse(text)));
        onBlur?.(e);
      }}
    />
  );
};
