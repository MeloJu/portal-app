/**
 * Backend fora do ar. O proxy do Vite responde 500 sem corpo quando não alcança o Spring, e um
 * gateway responde 502/503/504. Um 500 da própria API vem com o JSON do contrato e não entra aqui.
 */
export const OFFLINE_MESSAGE = "A estação da Lumi está fora do ar. Tente de novo em instantes.";

export function isOfflineResponse(status: number, hasJsonBody: boolean): boolean {
  return status === 502 || status === 503 || status === 504 || (status >= 500 && !hasJsonBody);
}

/** Erros dos clientes da API (AuthError, ApiError): sem conexão ou backend desligado. */
export function isApiOffline(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) return false;
  return error.code === "OFFLINE" || error.code === "NETWORK";
}
