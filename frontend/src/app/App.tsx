import { useEffect } from "react";
import { RouterProvider } from "react-router";
import PortalCursor from "./components/PortalCursor";
import { router } from "./routes";
import { listenForExpiredSession } from "./sessionExpiry";

export default function App() {
  useEffect(() => listenForExpiredSession(router), []);

  return (
    <>
      <PortalCursor />
      <RouterProvider router={router} />
    </>
  );
}
