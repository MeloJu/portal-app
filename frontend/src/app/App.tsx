import { RouterProvider } from "react-router";
import PortalCursor from "./components/PortalCursor";
import { router } from "./routes";

export default function App() {
  return (
    <>
      <PortalCursor />
      <RouterProvider router={router} />
    </>
  );
}
