import { useEffect, useState } from "react";
import { getOverview, type Overview } from "../api/dashboard";

/**
 * Dados da Visão geral, consultados por polling (o contrato não tem push). Com a aba escondida não
 * consulta; ao voltar para a aba ou para a janela, consulta na hora: quem acabou de atravessar um
 * portal em outra aba vê o número subir sem esperar o próximo ciclo. Uma falha mantém o último dado.
 */
export function useOverview(intervalMs = 5000, days = 12): Overview | null {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    let timer = 0;

    async function refresh() {
      window.clearTimeout(timer);
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const next = await getOverview(days);
        if (alive) setData(next);
      } catch {
        // Mantém o último dado; a próxima rodada tenta de novo.
      } finally {
        inFlight = false;
      }
      if (alive && !document.hidden) timer = window.setTimeout(refresh, intervalMs);
    }

    function onReturn() {
      if (document.hidden) window.clearTimeout(timer);
      else void refresh();
    }

    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    void refresh();
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [intervalMs, days]);

  return data;
}
