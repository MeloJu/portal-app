import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import LoginPage from "./LoginPage";

function renderLogin() {
  const router = createMemoryRouter(
    [
      { path: "/login", Component: LoginPage },
      { path: "/dashboard", element: <p>dashboard</p> },
    ],
    { initialEntries: ["/login"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("LoginPage", () => {
  it("mostra erro quando e-mail ou senha estão vazios", async () => {
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: /entrar na estação/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/preencha seu e-mail e sua senha/i);
    expect(window.localStorage.getItem("lumi-session")).toBeNull();
  });

  it("alterna a visibilidade da senha", async () => {
    renderLogin();
    const password = screen.getByPlaceholderText("Digite sua senha");
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar" }));
    expect(password).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Ocultar" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("cria a sessão e navega para o dashboard com credenciais preenchidas", async () => {
    const router = renderLogin();
    await userEvent.type(screen.getByPlaceholderText("voce@estacao.com"), "ana@lumi.studio");
    await userEvent.type(screen.getByPlaceholderText("Digite sua senha"), "segredo");
    await userEvent.click(screen.getByRole("button", { name: /entrar na estação/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"), { timeout: 3000 });
    expect(window.localStorage.getItem("lumi-session")).toBe("active");
  });
});
