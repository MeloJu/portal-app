import { createBrowserRouter, redirect, type RouteObject } from "react-router";
import { currentUser } from "../api/auth";
import Dashboard from "./Dashboard";
import LoginPage from "./pages/LoginPage";
import RedirectPage from "./pages/RedirectPage";

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
    path: "/r/:slug",
    Component: RedirectPage,
  },
  {
    path: "*",
    loader: () => redirect("/"),
  },
];

export const router = createBrowserRouter(routes);
