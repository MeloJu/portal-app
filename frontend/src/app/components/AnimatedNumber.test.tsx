import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AnimatedNumber from "./AnimatedNumber";

describe("AnimatedNumber", () => {
  afterEach(() => vi.restoreAllMocks());

  it("formata no padrão brasileiro", () => {
    render(<AnimatedNumber value={8429} />);
    expect(screen.getByText("8.429")).toBeInTheDocument();
  });

  it("quando o valor sobe, conta até o novo número e pisca", async () => {
    const { rerender, container } = render(<AnimatedNumber value={10} />);
    rerender(<AnimatedNumber value={11} />);
    expect(container.firstElementChild).toHaveClass("number-bump");
    await vi.waitFor(() => expect(screen.getByText("11")).toBeInTheDocument());
  });

  it("com movimento reduzido troca o número na hora", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    const { rerender } = render(<AnimatedNumber value={10} />);
    rerender(<AnimatedNumber value={1500} />);
    expect(screen.getByText("1.500")).toBeInTheDocument();
  });

  it("ao carregar o primeiro valor mostra direto, sem contar do zero", () => {
    const { rerender, container } = render(<AnimatedNumber value={null} />);
    rerender(<AnimatedNumber value={41} />);
    expect(screen.getByText("41")).toBeInTheDocument();
    expect(container.firstElementChild).not.toHaveClass("number-bump");
  });

  it("começa a contar do valor anterior, não pinta o novo antes", () => {
    const { rerender } = render(<AnimatedNumber value={10} />);
    rerender(<AnimatedNumber value={500} />);
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("sem valor mostra um traço", () => {
    render(<AnimatedNumber value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
