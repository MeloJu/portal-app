import { createBrowserRouter, redirect } from "react-router";
import Dashboard from "./Dashboard";
import LoginPage from "./pages/LoginPage";
import RedirectPage from "./pages/RedirectPage";

function hasSession() {
  return window.localStorage.getItem("lumi-session") === "active";
}

export const router = createBrowserRouter([
  {
    path: "/",
    loader: () => redirect(hasSession() ? "/dashboard" : "/login"),
  },
  {
    path: "/login",
    loader: () => (hasSession() ? redirect("/dashboard") : null),
    Component: LoginPage,
  },
  {
    path: "/dashboard",
    loader: () => (hasSession() ? null : redirect("/login")),
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
]);
