import { createBrowserRouter, redirect, type RouteObject } from "react-router";
import { currentUser } from "../api/auth";
import { travel } from "../api/travel";
import Dashboard from "./Dashboard";
import LoginPage from "./pages/LoginPage";
import TravelPage from "./pages/TravelPage";

/** A sessão é o cookie da API: quem decide se há usuário logado é o /api/me. */
export const routes: RouteObject[] = [
  {
    path: "/",
    loader: async () => redirect((await currentUser()) ? "/dashboard" : "/login"),
  },
  {
    path: "/login",
    loader: async () => ((await currentUser()) ? redirect("/dashboard") : null),
    Component: LoginPage,
  },
  {
    id: "dashboard",
    path: "/dashboard",
    loader: async () => (await currentUser()) ?? redirect("/login"),
    Component: Dashboard,
  },
  {
    // Travessia pública. A Viagem conta no loader (uma vez por navegação), nunca num useEffect.
    // /r/{code} é o 302 direto do backend (robôs), não uma tela do front.
    path: "/:code",
    loader: ({ params }) => travel(params.code!),
    Component: TravelPage,
  },
  {
    path: "*",
    loader: () => redirect("/"),
  },
];

export const router = createBrowserRouter(routes);
