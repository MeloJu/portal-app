import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PortalCursor, { PORTAL_CURSOR_ACTIVE } from "./PortalCursor";

function mockPointer(fine: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: fine && query.includes("pointer: fine"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

/** O jsdom não tem PointerEvent: um MouseEvent com o mesmo nome traz as coordenadas e o alvo. */
function pointer(type: string, target: EventTarget, x = 0, y = 0) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
}

const cursorOf = (container: HTMLElement) => container.querySelector(".custom-portal-cursor") as HTMLElement;

describe("PortalCursor", () => {
  beforeEach(() => mockPointer(true));
  afterEach(() => document.body.replaceChildren());

  it("começa invisível e sem esconder a seta do sistema", () => {
    const { container } = render(<PortalCursor />);
    expect(cursorOf(container)).toHaveAttribute("aria-hidden", "true");
    expect(cursorOf(container)).not.toHaveClass("visible");
    expect(document.documentElement).not.toHaveClass(PORTAL_CURSOR_ACTIVE);
  });

  it("segue o mouse e só então esconde a seta do sistema", () => {
    const { container } = render(<PortalCursor />);
    pointer("pointermove", window, 120, 80);

    expect(cursorOf(container)).toHaveClass("visible");
    expect(cursorOf(container).style.left).toBe("120px");
    expect(cursorOf(container).style.top).toBe("80px");
    expect(document.documentElement).toHaveClass(PORTAL_CURSOR_ACTIVE);
  });

  it("marca botões e links como interativos e campos de texto como texto", () => {
    const { container } = render(
      <>
        <PortalCursor />
        <button>ok</button>
        <input aria-label="campo" />
        <p>texto</p>
      </>,
    );
    const cursor = cursorOf(container);
    pointer("pointermove", container.querySelector("button")!);
    expect(cursor).toHaveClass("interactive");
    expect(cursor).not.toHaveClass("over-text");

    pointer("pointermove", container.querySelector("input")!);
    expect(cursor).toHaveClass("over-text");
    expect(cursor).not.toHaveClass("interactive");

    pointer("pointermove", container.querySelector("p")!);
    expect(cursor).not.toHaveClass("interactive");
    expect(cursor).not.toHaveClass("over-text");
  });

  it("anima o clique e some ao sair da janela", () => {
    vi.useFakeTimers();
    const { container } = render(<PortalCursor />);
    const cursor = cursorOf(container);
    pointer("pointermove", window, 10, 10);

    pointer("pointerdown", window);
    expect(cursor).toHaveClass("clicking");
    vi.advanceTimersByTime(520);
    expect(cursor).not.toHaveClass("clicking");

    pointer("mouseleave", document.documentElement);
    expect(cursor).not.toHaveClass("visible");
    vi.useRealTimers();
  });

  it("devolve a seta do sistema ao desmontar", () => {
    const { unmount } = render(<PortalCursor />);
    pointer("pointermove", window, 5, 5);
    expect(document.documentElement).toHaveClass(PORTAL_CURSOR_ACTIVE);

    unmount();
    expect(document.documentElement).not.toHaveClass(PORTAL_CURSOR_ACTIVE);
  });

  it("não faz nada com ponteiro de toque", () => {
    mockPointer(false);
    const { container } = render(<PortalCursor />);
    pointer("pointermove", window, 50, 50);

    expect(cursorOf(container)).not.toHaveClass("visible");
    expect(document.documentElement).not.toHaveClass(PORTAL_CURSOR_ACTIVE);
  });
});
