import { ApiError, request } from "./client";
import type { User } from "./auth";

export type CodePurpose = "EMAIL_CHANGE" | "PASSWORD_CHANGE";

export type RequestCodeInput = { purpose: CodePurpose; newEmail?: string };
export type ChangeEmailInput = { newEmail: string; code: string; currentPassword: string };
export type ChangePasswordInput = { code: string; currentPassword: string; newPassword: string };

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72;

export const passwordByteLength = (password: string) => new TextEncoder().encode(password).length;

export function requestCode({ purpose, newEmail }: RequestCodeInput): Promise<void> {
  return request<void>("/api/account/codes", {
    method: "POST",
    body: { purpose, ...(newEmail ? { newEmail } : {}) },
  });
}

export function changeEmail(input: ChangeEmailInput): Promise<User> {
  return request<User>("/api/account/email", { method: "POST", body: input });
}

export function changePassword(input: ChangePasswordInput): Promise<User> {
  return request<User>("/api/account/password", { method: "POST", body: input });
}

const hasCode = (error: unknown, code: string): error is ApiError => error instanceof ApiError && error.code === code;

export const isCodeInvalid = (error: unknown) => hasCode(error, "CODE_INVALID");
export const isCodeExpired = (error: unknown) => hasCode(error, "CODE_EXPIRED");
export const isCodeAttemptsExceeded = (error: unknown) => hasCode(error, "CODE_ATTEMPTS_EXCEEDED");
export const isWrongPassword = (error: unknown) => hasCode(error, "WRONG_PASSWORD");
export const isEmailTaken = (error: unknown) => hasCode(error, "EMAIL_TAKEN");
export const isEmailNotVerified = (error: unknown) => hasCode(error, "EMAIL_NOT_VERIFIED");

export const isRateLimited = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.status === 429 && !isCodeAttemptsExceeded(error);

export function formatWait(seconds: number | null): string {
  if (seconds === null) return "em instantes";
  if (seconds < 60) return `em ${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;
  const minutes = Math.ceil(seconds / 60);
  return `em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

export function describeAccountError(error: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  if (isCodeInvalid(error)) return "Código incorreto";
  if (isCodeExpired(error)) return "Código expirado, peça outro";
  if (isCodeAttemptsExceeded(error)) return "Muitas tentativas, peça um novo código";
  if (isWrongPassword(error)) return "Senha atual incorreta";
  if (isEmailTaken(error)) return "Este e-mail já está em uso";
  if (isEmailNotVerified(error)) return "Confirme seu e-mail para alterar estes dados";
  if (isRateLimited(error)) return `Muitas solicitações. Tente de novo ${formatWait(error.retryAfterSeconds)}.`;
  if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
    return "Confira os dados informados e tente de novo.";
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
