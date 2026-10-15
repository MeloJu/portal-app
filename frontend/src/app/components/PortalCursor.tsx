import { useEffect, useRef } from "react";

/** Classe no <html> enquanto o portal é o ponteiro; o CSS esconde a seta do sistema só com ela. */
export const PORTAL_CURSOR_ACTIVE = "has-portal-cursor";

/**
 * Ponteiro "portal" que acompanha o mouse. Fica montado uma vez na raiz do app, então vale em todas as rotas.
 * Só age com ponteiro preciso (mouse); em toque não faz nada.
 */
export default function PortalCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor || !window.matchMedia("(pointer: fine)").matches) return;

    const root = document.documentElement;
    let clickTimer = 0;

    function moveCursor(event: PointerEvent) {
      if (!cursor) return;
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
      cursor.classList.add("visible");
      // A seta do sistema só some depois que o portal já está na tela, para o ponteiro nunca desaparecer.
      root.classList.add(PORTAL_CURSOR_ACTIVE);

      const target = event.target instanceof Element ? event.target : null;
      cursor.classList.toggle("interactive", Boolean(target?.closest("button, a")));
      cursor.classList.toggle("over-text", Boolean(target?.closest("input, textarea, select")));
    }

    function animateClick() {
      if (!cursor) return;
      window.clearTimeout(clickTimer);
      cursor.classList.remove("clicking");
      void cursor.offsetWidth;
      cursor.classList.add("clicking");
      clickTimer = window.setTimeout(() => cursor.classList.remove("clicking"), 520);
    }

    function hideCursor() {
      cursor?.classList.remove("visible");
    }

    window.addEventListener("pointermove", moveCursor);
    window.addEventListener("pointerdown", animateClick);
    root.addEventListener("mouseleave", hideCursor);

    return () => {
      window.clearTimeout(clickTimer);
      window.removeEventListener("pointermove", moveCursor);
      window.removeEventListener("pointerdown", animateClick);
      root.removeEventListener("mouseleave", hideCursor);
      root.classList.remove(PORTAL_CURSOR_ACTIVE);
    };
  }, []);

  return (
    <div className="custom-portal-cursor" ref={cursorRef} aria-hidden="true">
      <span className="cursor-orbit orbit-alpha">
        <i />
      </span>
      <span className="cursor-orbit orbit-beta">
        <i />
      </span>
      <span className="cursor-center" />
      <span className="cursor-spark spark-one" />
      <span className="cursor-spark spark-two" />
      <span className="cursor-spark spark-three" />
    </div>
  );
}
