import type { DataRouter } from "react-router";
import { UNAUTHORIZED_EVENT } from "../api/client";

export function listenForExpiredSession(router: DataRouter): () => void {
  const onUnauthorized = () => {
    if (router.state.location.pathname === "/dashboard") void router.navigate("/login", { replace: true });
  };
  window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
}
