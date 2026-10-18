import { useLayoutEffect, useRef, useState } from "react";

const formatter = new Intl.NumberFormat("pt-BR");

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Número que, quando sobe, conta até o novo valor e pisca. Descer ou carregar troca na hora. */
export default function AnimatedNumber({ value, durationMs = 700 }: { value: number | null; durationMs?: number }) {
  // Valor intermediário enquanto conta; null quando não está animando (mostra `value` direto).
  const [counting, setCounting] = useState<number | null>(null);
  const previousRef = useRef(value);
  const countingRef = useRef<number | null>(null);

  // Layout effect: a contagem começa antes da pintura, sem mostrar o número final por um quadro.
  useLayoutEffect(() => {
    const from = countingRef.current ?? previousRef.current;
    previousRef.current = value;
    const show = (next: number | null) => {
      countingRef.current = next;
      setCounting(next);
    };
    if (value === null || from === null || value <= from || prefersReducedMotion()) {
      show(null);
      return;
    }

    show(from);
    const start = performance.now();
    const timer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / durationMs);
      if (progress < 1) {
        show(Math.round(from + (value - from) * (1 - (1 - progress) ** 3)));
        return;
      }
      window.clearInterval(timer);
      show(null);
    }, 16);
    return () => window.clearInterval(timer);
  }, [value, durationMs]);

  const shown = counting ?? value;
  return (
    <span className={counting !== null ? "number-bump" : undefined}>
      {shown === null ? "—" : formatter.format(shown)}
    </span>
  );
}
