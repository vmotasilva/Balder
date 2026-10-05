import React, { useRef } from 'react';

// `type` é aceito (e ignorado) para trocar um <input type="date"> por este componente sem mexer no resto
type DateInputProps = React.InputHTMLAttributes<HTMLInputElement>;

const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

/**
 * Campo de data (seletor do aparelho) com o atalho "Hoje" ao lado: o seletor nativo não tem esse botão.
 * Aceita as mesmas propriedades de um `<input>`; "Hoje" respeita `min`/`max` e dispara o `onChange` normal.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(({ style, type: _type, ...props }, forwardedRef) => {
  const innerRef = useRef<HTMLInputElement | null>(null);
  const today = todayIso();
  const outOfRange = (!!props.min && today < String(props.min)) || (!!props.max && today > String(props.max));
  const isToday = props.value === today;

  const setToday = () => {
    const el = innerRef.current;
    if (!el) return;
    // Atribui pelo setter nativo e dispara o evento: o React vê como uma digitação e chama o onChange
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, today);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  return (
    <span style={{ display: 'flex', gap: '6px', alignItems: 'stretch', width: '100%', minWidth: 0 }}>
      <DateInput
        {...props}
        type="date"
        style={{ flex: 1, minWidth: 0, ...style }}
        ref={(el) => {
          innerRef.current = el;
          if (typeof forwardedRef === 'function') forwardedRef(el);
          else if (forwardedRef) forwardedRef.current = el;
        }}
      />
      {!props.disabled && !props.readOnly && !outOfRange && (
        <button type="button" className="btn btn-outline btn-xs" onClick={setToday} disabled={isToday} title="Usar a data de hoje">
          Hoje
        </button>
      )}
    </span>
  );
});
DateInput.displayName = 'DateInput';
