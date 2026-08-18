# GameNest

Spin up game servers (Minecraft, Valheim, and friends) in a few clicks — on your
own PC while developing, or on a cloud VM later — from a web dashboard.

## Architecture

```
apps/
  web/     React + Vite dashboard
  api/     NestJS control plane (REST + WebSocket gateway, owns Postgres)
  agent/   NestJS node agent — runs on any host that hosts game servers.
           Dials OUT to api/ over WebSocket (works behind home-router NAT),
           executes Docker commands locally via dockerode.
packages/
  shared-types/  DTOs + the agent<->control-plane WS protocol, imported by
                 all three apps so the wire format stays type-safe end to end.
```

See [`packages/shared-types/src/agent-protocol.ts`](packages/shared-types/src/agent-protocol.ts)
for the full rationale on the control-plane/agent split.

## Getting started

Requires Node >= 20, [pnpm](https://pnpm.io), and Docker (for Postgres now, and
for running the agent against real containers later).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/agent/.env.example apps/agent/.env
pnpm db:up                # starts Postgres via docker-compose
pnpm --filter @gamenest/api prisma:migrate   # applies the schema (first run only)
pnpm dev
```

`pnpm dev` runs `web`, `api`, and `agent` together via Turborepo. Individual apps:

```bash
pnpm --filter @gamenest/web dev     # http://localhost:5173
pnpm --filter @gamenest/api dev     # http://localhost:3000
pnpm --filter @gamenest/agent dev   # http://localhost:3001 (health check only)
```

## Database

Postgres via Docker Compose + Prisma (schema at
[`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma), mirroring
the shapes in `shared-types`). `api` connects on boot via `PrismaService`.

```bash
pnpm db:up                                   # start Postgres
pnpm --filter @gamenest/api prisma:migrate   # create/apply a migration after schema changes
pnpm db:studio                               # local GUI to browse the data
pnpm db:down                                 # stop Postgres
```

## Status

The agent ↔ control-plane WebSocket handshake is working: `agent` generates
(and persists) a stable node id, dials out to `api`'s `/agent` namespace,
registers with a shared-secret token, and heartbeats every 15s. `api` tracks
connected nodes in memory and exposes them at `GET /nodes`. Auth is a single
shared secret for now (`AGENT_REGISTRATION_SECRET` / `AGENT_TOKEN` in the
`.env` files) — fine for you + friends, will become per-node issued tokens
once nodes are persisted through Prisma instead of the in-memory registry.

Postgres + Prisma are wired up and migrated, but nothing writes to it yet —
nodes/servers still live only in `NodeRegistryService`'s in-memory map.
Not implemented yet: anything Docker. The next steps are (1) persisting
nodes/servers/templates through Prisma instead of memory, and (2) having the
agent actually create/start/stop containers when it receives `command.*`
messages (currently it just logs that it received them), starting with one
GameTemplate (Minecraft).
