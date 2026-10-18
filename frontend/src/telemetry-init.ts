/**
 * Liga a telemetria ANTES de qualquer outro módulo do app: precisa ser o primeiro import do main.tsx.
 *
 * O router é criado no nível do módulo (`createBrowserRouter` em routes.tsx) e isso já roda os loaders, inclusive o
 * `/api/me`. Se a telemetria ligasse no corpo do main.tsx, essa primeira chamada sairia sem `traceparent`, porque os
 * imports são avaliados antes do corpo do módulo que os importa.
 */
import { startTelemetry, telemetryEnabled } from "./telemetry";

if (telemetryEnabled(import.meta.env)) startTelemetry();
