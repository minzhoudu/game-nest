# GameNest

Spin up game servers (Minecraft, Valheim, and friends) in a few clicks — on your
own PC while developing, or on a cloud VM later — from a web dashboard.

## Architecture

```
apps/
  web/     React + Vite dashboard, React Router for real URLs per page:
             /                  server list (info only — name, status,
                                connect address+copy; no actions)
             /servers/new       create-server form
             /servers/:id       detail page — start/stop/delete
             /servers/:id/logs  logs only
           Two WS channels involved: agents talk to api over /agent (below);
           the dashboard talks to api over /dashboard (DashboardGateway) for
           live push — no polling.
  api/     NestJS control plane (REST + WebSocket gateways, owns Postgres)
           - /auth                register/login, issues a JWT
           - /templates            available games (hardcoded for now)
           - /servers              create/start/stop/delete a server, its logs
                                    — all scoped to the logged-in user
           - /nodes                connected agents — shared, not owned
           - WS /agent             agents connect here (NodesGateway)
           - WS /dashboard         browsers connect here for live push
                                    (DashboardGateway) — authenticated, and
                                    server events are routed per-owner
  agent/   NestJS node agent — runs on any host that hosts game servers.
           Dials OUT to api/ over WebSocket (works behind home-router NAT),
           executes Docker commands locally via dockerode (DockerService).
packages/
  shared-types/  DTOs + both WS protocols (agent<->api, api<->dashboard),
                 imported by all three apps so the wire format stays
                 type-safe end to end.
```

See [`packages/shared-types/src/agent-protocol.ts`](packages/shared-types/src/agent-protocol.ts)
for the full rationale on the control-plane/agent split.

## Design notes

**Servers are owned per-user; nodes are shared infrastructure, not owned.**
The original pitch was "I run the agent on my PC, my friends spin up servers
on it" — if nodes were per-user-owned too, that breaks, since friends don't
have their own agent. So: any logged-in user can deploy to any connected
node, but each user only sees and manages their own servers. `GameNode` has
an `ownerId` column in the Prisma schema already (for whenever real
per-node tokens replace the one shared secret), but nothing populates it
yet — nodes still aren't persisted at all, see Status below.

## Getting started

Requires Node >= 20, [pnpm](https://pnpm.io), and Docker (for Postgres now, and
for running the agent against real containers later).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/agent/.env.example apps/agent/.env
# edit apps/api/.env: set JWT_SECRET to any long random string
pnpm db:up                # starts Postgres via docker-compose
pnpm --filter @gamenest/api prisma:migrate   # applies the schema (first run only)
pnpm dev
```

First run: open the dashboard, sign up an account (email/password — no email
verification, this isn't gated on anything). Everything after that is scoped
to whoever's logged in.

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

**Accounts + persistence are in.** Email/password auth (JWT), and
`GameServer` rows are real Postgres rows now, owned per-user — restart `api`
and your servers are still there (the Docker containers never stopped
either; `api` restarting only used to lose track of them, verified fixed by
actually killing and restarting `api` mid-session and confirming a server
survived with correct status). Every `/servers`/`/nodes`/`/templates`
request requires a bearer token (`JwtAuthGuard`); `/servers` is additionally
scoped so you only ever see your own — verified by holding two different
users' tokens simultaneously and confirming each `GET /servers` returns only
that user's data. Nodes stay shared infrastructure, not owned by anyone —
see Design notes below for why. Google/OAuth login is planned but not
started; the schema (`User.passwordHash` nullable) is shaped so adding it
later won't need a breaking migration.

The dashboard's live-push channel (`/dashboard`) is authenticated too: a
socket without a valid token gets disconnected on connect, and
server-created/status/removed/log events are routed to a room named after
the owning user's id rather than broadcast to everyone — so two people using
the same GameNest instance never see each other's servers, even over the
push channel. Verified with two real accounts in two tabs. Node events
(connect/disconnect) still broadcast to everyone, matching nodes being
shared.

**The dashboard is multi-page, with real URLs per page** (React Router)
instead of local component state — refreshing `/servers/:id` or
`/servers/:id/logs` lands you back on the same page with the same data,
rather than resetting to the list. The list page (`/`) shows just name,
status, and a copyable connect address, no action buttons; actions
(start/stop/delete) live on the detail page (`/servers/:id`); logs are their
own page (`/servers/:id/logs`). The connect address shown is a best-effort
`host:port` derived from `VITE_API_URL`'s hostname + the template's game
port — only actually correct when the node is the same machine as `api`
(true for local dev, not once nodes can be remote; see
`apps/web/src/lib/connect-address.ts`).

**The dashboard works end to end, live — no polling.** Create a server (pick
a node, a game, a name), watch it go `creating` → `running`, watch its logs
stream in as they happen, stop/start/delete it — every state change arrives
pushed over the `/dashboard` WebSocket the instant it happens; REST calls
fire once on load, not on an interval. Verified against real Docker
containers with the network tab open: no repeat requests ever, even across a
full Minecraft boot.

Under the hood: internal events already flowed through
`@nestjs/event-emitter` (`apps/api/src/events/internal-events.ts`) to
decouple `NodesGateway`/`ServersService`/`DashboardGateway` from importing
each other — `DashboardGateway` listens to that same bus and re-shapes each
event into the `DashboardEvent` wire format
(`packages/shared-types/src/dashboard-protocol.ts`).
`NodeSummary`/`ServerSummary` in `shared-types` are the one shape used for
REST responses, the dashboard snapshot, and every push event.

The agent ↔ control-plane WebSocket handshake (separate channel, `/agent`,
not the same auth as users): `agent` generates (and persists) a stable node
id, dials out to `api`, registers with a shared-secret token, heartbeats
every 15s. `api` exposes a request/response layer over that socket
(`NodeCommandService`) so REST calls can `await` a command's `command.ack`.
Node auth is still a single shared secret (`AGENT_REGISTRATION_SECRET` /
`AGENT_TOKEN`) — fine for "you run the node, friends use it," becomes
per-node issued tokens if/when nodes need finer-grained ownership.

**Two `GameTemplate`s now: Minecraft (Java) and 7 Days to Die**, both
hardcoded in `TemplatesService` but upserted into Postgres on boot so
`GameServer.templateId` is a real FK — see
[apps/api/src/templates](apps/api/src/templates). 7 Days to Die
(`vinanrra/7dtd-server`) has a much sparser "Advanced options" than
Minecraft — its dedicated server configures gameplay settings (name,
password, difficulty, max players) via an XML file inside the container,
not env vars, so none of that is exposed here yet (would need this app to
write a config file into a volume at container-create time — a real future
feature, not built). Verified live: created a real server through the API,
confirmed the container picked up `VERSION=stable` from its own logs, and
watched it correctly proceed into the SteamCMD install/download step before
stopping the test (didn't wait through the full multi-GB download).

`EnvVarSchema` (`packages/shared-types/src/entities.ts`) grew `select` and
`range` field types so "Advanced options" can offer real constraints
instead of free text — Minecraft's version is now a dropdown of known-good
versions, memory is a slider (1–8 GB, deliberately constrained to whole
numbers — the intent is this becomes the basis for billing by memory tier
later), and difficulty is a dropdown instead of arbitrary text. A `hidden`
flag also exists for env vars a template needs but shouldn't ask the user
about (7 Days to Die's `START_MODE`).

Not done yet: real port allocation (currently host port == container port,
so only one server per port per node at a time — this is also why the
Minecraft port-conflict bug below was easy to hit), Google/OAuth login, and
`GameNode` itself isn't persisted (nodes are deliberately still
connection-scoped/in-memory — see Design notes).

**Bug found and fixed while testing this**: if `command.createContainer`
succeeded but the subsequent `command.startContainer` failed (e.g. a port
already in use), the container was left orphaned on the node forever — only
the database row got cleaned up. `ServersController.create()`'s error path
now also best-effort sends `command.deleteContainer` before giving up.
Reproduced the failure twice (real port conflict) to confirm: broken before
the fix (orphaned container left behind), clean after (nothing left,
`docker ps -a` empty).

**Running the dashboard locally:**

```bash
cp apps/web/.env.example apps/web/.env   # VITE_API_URL, defaults to localhost:3000
pnpm --filter @gamenest/web dev          # http://localhost:5173
```
