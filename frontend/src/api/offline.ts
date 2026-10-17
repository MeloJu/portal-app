export const OFFLINE_MESSAGE = "A estação da Lumi está fora do ar. Tente de novo em instantes.";

export function isOfflineResponse(status: number, hasJsonBody: boolean): boolean {
  return status === 502 || status === 503 || status === 504 || (status >= 500 && !hasJsonBody);
}

export function isApiOffline(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) return false;
  return error.code === "OFFLINE" || error.code === "NETWORK";
}
