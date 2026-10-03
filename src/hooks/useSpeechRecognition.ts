import { useCallback, useEffect, useRef, useState } from 'react';

// A Web Speech API ainda não está no lib.dom do TypeScript
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const getCtor = (): SpeechRecognitionCtor | undefined => {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};

/**
 * Ditado por voz em português. `onFinal` recebe o texto reconhecido ao terminar de falar;
 * `onInterim` (opcional) recebe o texto parcial enquanto a pessoa fala.
 */
export function useSpeechRecognition(opts: { onFinal: (text: string) => void; onInterim?: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const supported = !!getCtor();

  const stop = useCallback(() => recRef.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError('Seu navegador não permite comando de voz. Tente o Chrome.');
      return;
    }
    setError(null);
    const rec = new Ctor();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = true;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const piece = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += piece;
        else interim += piece;
      }
      if (interim) optsRef.current.onInterim?.((finalText + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Permita o uso do microfone para falar com a Forseti.');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError('Não consegui ouvir. Tente de novo.');
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const text = finalText.trim();
      if (text) optsRef.current.onFinal(text);
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, []);

  const toggle = useCallback(() => (recRef.current ? stop() : start()), [start, stop]);

  useEffect(() => () => recRef.current?.stop(), []);

  return { supported, listening, error, toggle };
}
