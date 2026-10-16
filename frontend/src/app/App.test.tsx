import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

// Sem sessão: a rota inicial manda para o login.
vi.mock("../api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/auth")>()),
  currentUser: vi.fn().mockResolvedValue(null),
}));

describe("App", () => {
  it("monta o cursor portal na raiz, valendo também na tela de login", async () => {
    const { container, findByRole } = render(<App />);

    await findByRole("button", { name: /entrar/i });
    expect(container.querySelector(".custom-portal-cursor")).toBeInTheDocument();
  });
});
