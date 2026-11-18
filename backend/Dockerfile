# Metropolitan Ticketing System — backend image (IT Ticketing + Maintenance modules)
# Build context: ./backend
#
# The runtime image runs BOTH Prisma schemas (IT: prisma/, Maintenance:
# maintenance/prisma/) with migration-on-deploy, seeds reference data, then
# starts the merged Express server (which mounts /api and /api/maintenance).

# ---------- build stage -------------------------------------------------------
FROM node:20-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# IT Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Maintenance schema + generated client (custom output: maintenance/generated/client)
COPY maintenance ./maintenance
RUN npx prisma generate --schema maintenance/prisma/schema.prisma

# Compile the TypeScript host (src -> dist). The maintenance module stays CommonJS.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime ---
FROM node:20-slim AS runtime
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/maintenance ./maintenance
COPY --from=build /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Maintenance attachments (bind a volume here in production).
RUN mkdir -p ./maintenance/uploads

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
