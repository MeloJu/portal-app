import { createMemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { UNAUTHORIZED_EVENT } from "../api/client";
import { listenForExpiredSession } from "./sessionExpiry";

const routes = [
  { path: "/dashboard", element: null },
  { path: "/login", element: null },
  { path: "/:code", element: null },
];

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
});

const expire = () => window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));

describe("listenForExpiredSession", () => {
  it("manda para o login quando a sessão expira com o dashboard aberto", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/dashboard"] });
    stop = listenForExpiredSession(router);

    expire();

    await expect.poll(() => router.state.location.pathname).toBe("/login");
  });

  it("não mexe na Travessia nem no login", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/meu-portal"] });
    stop = listenForExpiredSession(router);

    expire();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.state.location.pathname).toBe("/meu-portal");
  });

  it("para de escutar depois de desligado", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/dashboard"] });
    listenForExpiredSession(router)();

    expire();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.state.location.pathname).toBe("/dashboard");
  });
});
