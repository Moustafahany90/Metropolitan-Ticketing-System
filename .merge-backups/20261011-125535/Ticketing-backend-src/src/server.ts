import app from "./app";
import { env } from "./config/env";
import { prisma } from "./prisma/client";

async function main() {
  await prisma.$connect();
  console.log("Connected to PostgreSQL.");

  app.listen(env.PORT, () => {
    console.log(`Metropolitan Ticketing System API listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
