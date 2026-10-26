import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { requireCronSecret } from "./cron";
import { registerStorageProxy } from "./storageProxy";
import { registerPhotoUploadRoutes } from "../photoUpload";
import { registerSEORoutes } from "../seo";
import { scrapeEventsHandler } from "../scheduledScrape";
import { birthdayRemindersHandler } from "../scheduledBirthdayReminders";
import { refreshEventsHandler } from "../handlers/refreshEvents";
import { registerVoiceRoutes } from "../voiceUpload";
import { registerStripeWebhook } from "../stripeCheckout";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { corsMiddleware } from "./cors";
import { diagnoseAuth } from "./authDiagnose";
import { installShutdownHandlers, logStartup } from "./startup";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Railway terminates TLS in front of the app.
  app.set("trust proxy", 1);
  // Liveness probe for Railway; registered first so it never depends on anything else.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  registerStripeWebhook(app);
  app.use(corsMiddleware);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Says why a sign-in is rejected (stage and error code only). See DEPLOY.md.
  app.get("/api/auth/diagnose", diagnoseAuth);
  registerStorageProxy(app);
  registerPhotoUploadRoutes(app);
  registerVoiceRoutes(app, server);
  registerSEORoutes(app);
  // Scheduled jobs: require Authorization: Bearer CRON_SECRET
  app.use("/api/scheduled", requireCronSecret);
  app.post("/api/scheduled/scrape-events", scrapeEventsHandler);
  app.post("/api/scheduled/birthday-reminders", birthdayRemindersHandler);
  app.post("/api/scheduled/refresh-events", refreshEventsHandler);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // API only: the SPA is hosted separately (Vercel).
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  // In production the platform assigns the port; never drift to another one.
  const port = process.env.NODE_ENV === "development" ? await findAvailablePort(preferredPort) : preferredPort;

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    logStartup(port);
  });
  installShutdownHandlers(server);
}

// A failed start must exit non-zero so the platform marks the deploy as crashed instead of idle.
startServer().catch(error => {
  console.error("[startup] fatal:", error);
  process.exit(1);
});
