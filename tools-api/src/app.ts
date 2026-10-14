import express, { type NextFunction, type Request, type Response } from "express";
import { ApiError } from "./errors.ts";
import { scanUrl } from "./scan.ts";
import { unshorten } from "./unshorten.ts";

type Handlers = { unshorten: typeof unshorten; scan: typeof scanUrl };

/** Limite simples por IP em janela fixa (em memória). */
function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    if (++entry.count > max) return next(new ApiError(429, "RATE_LIMIT", "Muitas requisições. Aguarde um instante."));
    next();
  };
}

export function createApp(handlers: Partial<Handlers> = {}, limit = { max: 20, windowMs: 60_000 }) {
  const h: Handlers = { unshorten, scan: scanUrl, ...handlers };
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "8kb" }));
  app.use("/tools", rateLimit(limit.max, limit.windowMs));

  app.get("/tools/health", (_req, res) => res.json({ status: "ok" }));

  app.post("/tools/unshorten", async (req, res, next) => {
    try {
      res.json(await h.unshorten(req.body?.url));
    } catch (err) {
      next(err);
    }
  });

  app.post("/tools/scan", async (req, res, next) => {
    try {
      res.json(await h.scan(req.body?.url));
    } catch (err) {
      next(err);
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) return res.status(err.status).json({ code: err.code, message: err.message });
    if (err instanceof SyntaxError) return res.status(400).json({ code: "INVALID_URL", message: "Corpo inválido." });
    console.error(err);
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Algo deu errado." });
  });

  return app;
}
