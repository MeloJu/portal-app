import { useCallback, useEffect, useState, type DependencyList } from "react";

type ApiState<T> = { data: T | null; error: Error | null; loading: boolean };

export function useApi<T>(load: (signal: AbortSignal) => Promise<T>, deps: DependencyList) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, error: null, loading: true }));
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const err = error instanceof Error ? error : new Error("Algo deu errado. Tente novamente.");
        setState((prev) => ({ data: prev.data, error: err, loading: false }));
      },
    );
    return () => controller.abort();
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
