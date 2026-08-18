# GameNest

Spin up game servers (Minecraft, Valheim, and friends) in a few clicks — on your
own PC while developing, or on a cloud VM later — from a web dashboard.

## Architecture

```
apps/
  web/     React + Vite dashboard
  api/     NestJS control plane (REST + WebSocket gateway, owns Postgres)
           - /templates  available games (hardcoded for now — see TemplatesService)
           - /servers    create/start/stop/delete a game server, view its logs
           - /nodes      connected agents
  agent/   NestJS node agent — runs on any host that hosts game servers.
           Dials OUT to api/ over WebSocket (works behind home-router NAT),
           executes Docker commands locally via dockerode (DockerService).
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

**The dashboard works end to end** — open `http://localhost:5173` with
`api` + at least one `agent` running: create a server (pick a node, a game,
a name), watch it go `creating` → `running`, view its live-ish log tail
(polled every 2s), stop/start/delete it. Verified in a real browser against
real Docker containers, not just unit-tested.

Under the hood: `POST /servers` creates a Docker container on the chosen
node and starts it; the agent tails the container and streams
`container.log` messages back through the WS pipeline (agent → api's event
emitter → `ServersService`'s per-server ring buffer → `GET /servers/:id/logs`,
polled by the dashboard). The agent ↔ control-plane WebSocket handshake:
`agent` generates (and persists) a stable node id, dials out to `api`'s
`/agent` namespace, registers with a shared-secret token, heartbeats every
15s. `api` tracks connected nodes in memory (`GET /nodes`) and exposes a
request/response layer over the socket (`NodeCommandService`) so REST calls
can `await` a command's `command.ack`. Auth is a single shared secret for
now (`AGENT_REGISTRATION_SECRET` / `AGENT_TOKEN`) — fine for you + friends,
will become per-node issued tokens once nodes are persisted.

Only one `GameTemplate` exists (`minecraft-java`, hardcoded in
`TemplatesService` — see [apps/api/src/templates](apps/api/src/templates)).
Postgres + Prisma are migrated and connected but **nothing persists through
them yet** — nodes and servers both still live in in-memory maps, so an `api`
restart forgets every server that exists (the Docker containers themselves
keep running fine; the control plane just loses track of them). That's the
next real gap to close.

Not done yet: persistence (see above), a second GameTemplate, real port
allocation (currently host port == container port, so only one server per
port per node at a time), live-pushed logs over the socket instead of
polling, and any auth beyond the one shared secret.

**Running the dashboard locally:**

```bash
cp apps/web/.env.example apps/web/.env   # VITE_API_URL, defaults to localhost:3000
pnpm --filter @gamenest/web dev          # http://localhost:5173
```
