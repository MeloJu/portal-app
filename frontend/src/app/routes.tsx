import { createBrowserRouter, redirect, type RouteObject } from "react-router";
import { AuthError, currentUser, verifyEmail } from "../api/auth";
import { travel } from "../api/travel";
import Dashboard from "./Dashboard";
import LoginPage from "./pages/LoginPage";
import RouteErrorPage from "./pages/RouteErrorPage";
import TravelPage from "./pages/TravelPage";
import VerifyEmailPage, { type VerifyEmailData, type VerifyEmailStatus } from "./pages/VerifyEmailPage";

async function verificationStatus(token: string | null): Promise<VerifyEmailStatus> {
  if (!token) return "invalid";
  try {
    await verifyEmail(token);
    return "verified";
  } catch (err) {
    if (err instanceof AuthError && err.isTokenExpired) return "expired";
    if (err instanceof AuthError && err.isTokenInvalid) return "invalid";
    throw err;
  }
}

async function verifyEmailLoader({ request }: { request: Request }): Promise<VerifyEmailData> {
  const status = await verificationStatus(new URL(request.url).searchParams.get("token"));
  return { status, loggedIn: (await currentUser()) !== null };
}

/** A sessão é o cookie da API: quem decide se há usuário logado é o /api/me. */
export const routes: RouteObject[] = [
  {
    // API fora do ar: qualquer loader que lance cai aqui, na tela de estação fora do ar.
    ErrorBoundary: RouteErrorPage,
    children: [
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
        path: "/verificar-email",
        loader: verifyEmailLoader,
        Component: VerifyEmailPage,
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
    ],
  },
];

export const router = createBrowserRouter(routes);
