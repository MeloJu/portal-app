import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./client";

export type ApiState<T> = {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  /** Busca de novo mantendo o data atual na tela até chegar o novo. */
  reload: () => void;
};

/**
 * GET para telas de leitura: roda load ao montar e quando deps mudam.
 * No StrictMode o load roda duas vezes em dev, o que é inofensivo para leitura. A Travessia não usa este hook:
 * cada GET /api/travel registra uma Viagem, por isso ela chama a API no loader.
 */
export function useApi<T>(load: () => Promise<T>, deps: unknown[]): ApiState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError>();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Resposta que chega depois do unmount ou de uma busca mais nova é descartada.
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    load().then(
      (result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err : new ApiError(0, "UNKNOWN", "Algo deu errado. Tente novamente."));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // load é recriado a cada render; quem decide quando buscar de novo são deps e reload.
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { data, error, loading, reload };
}
