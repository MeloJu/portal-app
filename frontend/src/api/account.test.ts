import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changeEmail,
  changePassword,
  describeAccountError,
  formatWait,
  isCodeAttemptsExceeded,
  isCodeExpired,
  isCodeInvalid,
  isEmailNotVerified,
  isEmailTaken,
  isRateLimited,
  isWrongPassword,
  passwordByteLength,
  requestCode,
} from "./account";
import { ApiError } from "./client";

function reply(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(status === 204 ? null : JSON.stringify(body), { status, headers })),
  );
}

const sentBody = () => JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);

const user = { id: "u1", name: "Ana", email: "novo@lumi.dev", emailVerified: true };

describe("account api", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requestCode faz POST /api/account/codes com a finalidade e o novo e-mail", async () => {
    reply(204);
    await expect(requestCode({ purpose: "EMAIL_CHANGE", newEmail: "novo@lumi.dev" })).resolves.toBeUndefined();
    const [path, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(path).toBe("/api/account/codes");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(sentBody()).toEqual({ purpose: "EMAIL_CHANGE", newEmail: "novo@lumi.dev" });
  });

  it("requestCode de senha não manda newEmail", async () => {
    reply(204);
    await requestCode({ purpose: "PASSWORD_CHANGE" });
    expect(sentBody()).toEqual({ purpose: "PASSWORD_CHANGE" });
  });

  it("changeEmail faz POST /api/account/email e devolve o usuário", async () => {
    reply(200, user);
    const input = { newEmail: "novo@lumi.dev", code: "123456", currentPassword: "senhaatual1" };
    await expect(changeEmail(input)).resolves.toEqual(user);
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe("/api/account/email");
    expect(sentBody()).toEqual(input);
  });

  it("changePassword faz POST /api/account/password e devolve o usuário", async () => {
    reply(200, user);
    const input = { code: "123456", currentPassword: "senhaatual1", newPassword: "novasenha123" };
    await expect(changePassword(input)).resolves.toEqual(user);
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe("/api/account/password");
    expect(sentBody()).toEqual(input);
  });

  it("erros chegam como ApiError com status e code", async () => {
    reply(403, { code: "WRONG_PASSWORD", message: "x" });
    const error = await changeEmail({ newEmail: "a@b.co", code: "1", currentPassword: "p" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: "WRONG_PASSWORD", retryAfterSeconds: null });
    expect(isWrongPassword(error)).toBe(true);
  });

  it("429 expõe o Retry-After", async () => {
    reply(429, { code: "RATE_LIMIT" }, { "Retry-After": "45" });
    const error = await requestCode({ purpose: "PASSWORD_CHANGE" }).catch((e) => e);
    expect(error.retryAfterSeconds).toBe(45);
    expect(isRateLimited(error)).toBe(true);
  });

  it("429 sem Retry-After válido deixa retryAfterSeconds nulo", async () => {
    reply(429, { code: "RATE_LIMIT" }, { "Retry-After": "logo" });
    const error = await requestCode({ purpose: "PASSWORD_CHANGE" }).catch((e) => e);
    expect(error.retryAfterSeconds).toBeNull();
  });

  it("helpers reconhecem cada code", () => {
    expect(isCodeInvalid(new ApiError(400, "CODE_INVALID", ""))).toBe(true);
    expect(isCodeExpired(new ApiError(400, "CODE_EXPIRED", ""))).toBe(true);
    expect(isCodeAttemptsExceeded(new ApiError(429, "CODE_ATTEMPTS_EXCEEDED", ""))).toBe(true);
    expect(isEmailTaken(new ApiError(409, "EMAIL_TAKEN", ""))).toBe(true);
    expect(isEmailNotVerified(new ApiError(403, "EMAIL_NOT_VERIFIED", ""))).toBe(true);
    expect(isRateLimited(new ApiError(429, "CODE_ATTEMPTS_EXCEEDED", ""))).toBe(false);
    expect(isWrongPassword(new Error("x"))).toBe(false);
  });

  it("describeAccountError traduz cada code", () => {
    expect(describeAccountError(new ApiError(400, "CODE_INVALID", "x"))).toBe("Código incorreto");
    expect(describeAccountError(new ApiError(400, "CODE_EXPIRED", "x"))).toBe("Código expirado, peça outro");
    expect(describeAccountError(new ApiError(429, "CODE_ATTEMPTS_EXCEEDED", "x"))).toBe(
      "Muitas tentativas, peça um novo código",
    );
    expect(describeAccountError(new ApiError(403, "WRONG_PASSWORD", "x"))).toBe("Senha atual incorreta");
    expect(describeAccountError(new ApiError(409, "EMAIL_TAKEN", "x"))).toBe("Este e-mail já está em uso");
    expect(describeAccountError(new ApiError(429, "RATE_LIMIT", "x", 90))).toBe(
      "Muitas solicitações. Tente de novo em 2 minutos.",
    );
    expect(describeAccountError(new ApiError(400, "VALIDATION_ERROR", "newPassword: must"))).toBe(
      "Confira os dados informados e tente de novo.",
    );
    expect(describeAccountError(new ApiError(0, "NETWORK", "Sem conexão"))).toBe("Sem conexão");
    expect(describeAccountError("estranho")).toBe("Algo deu errado. Tente novamente.");
  });

  it("formatWait escolhe segundos ou minutos", () => {
    expect(formatWait(null)).toBe("em instantes");
    expect(formatWait(1)).toBe("em 1 segundo");
    expect(formatWait(59)).toBe("em 59 segundos");
    expect(formatWait(60)).toBe("em 1 minuto");
    expect(formatWait(61)).toBe("em 2 minutos");
  });

  it("passwordByteLength conta bytes UTF-8, não caracteres", () => {
    expect(passwordByteLength("abc")).toBe(3);
    expect(passwordByteLength("é".repeat(36))).toBe(72);
    expect(passwordByteLength("😀")).toBe(4);
  });
});
