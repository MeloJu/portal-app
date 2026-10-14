export class ApiError extends Error {
  status: number;
  code: string;
  /** Campos extras devolvidos junto de { code, message } (ex.: gateUrl). */
  details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
