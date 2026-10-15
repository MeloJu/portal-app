import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("monta o cursor portal na raiz, valendo também na tela de login", async () => {
    const { container, findByRole } = render(<App />);

    await findByRole("button", { name: /entrar/i });
    expect(container.querySelector(".custom-portal-cursor")).toBeInTheDocument();
  });
});
