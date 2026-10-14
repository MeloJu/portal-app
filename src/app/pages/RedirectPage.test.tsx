import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import RedirectPage from "./RedirectPage";

function renderSlug(slug: string) {
  const router = createMemoryRouter([{ path: "/r/:slug", Component: RedirectPage }], {
    initialEntries: [`/r/${slug}`],
  });
  render(<RouterProvider router={router} />);
}

describe("RedirectPage", () => {
  it("exibe o destino conhecido e exige confirmação para prosseguir", () => {
    renderSlug("nebulosa");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("example.com");
    expect(screen.getByText("Campanha Nebulosa")).toBeInTheDocument();
    const proceed = screen.getByRole("link", { name: /sim, prosseguir/i });
    expect(proceed).toHaveAttribute("href", "https://example.com/campanha-nebulosa");
    expect(proceed).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByRole("button", { name: /não, voltar/i })).toBeInTheDocument();
  });

  it("usa um destino padrão para slugs desconhecidos", () => {
    renderSlug("inexistente");
    expect(screen.getByText("Destino Lumi")).toBeInTheDocument();
  });
});
