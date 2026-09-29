import React, { useState } from 'react';

type NativeProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'type'>;

interface NumberInputProps extends NativeProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Valor quando a pessoa sai do campo vazio (padrão: o mínimo, ou 0). */
  fallback?: number;
}

/**
 * Campo de número inteiro que pode ser apagado enquanto se digita: o texto fica livre durante a edição
 * e o mínimo/máximo só são aplicados ao sair do campo. (Limitar a cada tecla devolvia o número na hora,
 * sem deixar apagar para digitar outro.)
 */
export const NumberInput: React.FC<NumberInputProps> = ({ value, onValueChange, min, max, fallback, onBlur, onFocus, ...rest }) => {
  // null = sem edição em andamento: mostra o valor recebido
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n));

  return (
    <input
      {...rest}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft ?? (Number.isFinite(value) ? String(value) : '')}
      onFocus={(e) => {
        setDraft(Number.isFinite(value) ? String(value) : '');
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const n = parseInt(raw, 10);
        // Enquanto digita, só repassa números dentro do limite superior; o mínimo vale ao sair
        if (raw.trim() !== '' && Number.isFinite(n)) onValueChange(max !== undefined ? Math.min(max, n) : n);
      }}
      onBlur={(e) => {
        const n = parseInt(draft ?? '', 10);
        setDraft(null);
        onValueChange(clamp(Number.isFinite(n) ? n : fallback ?? min ?? 0));
        onBlur?.(e);
      }}
    />
  );
};
