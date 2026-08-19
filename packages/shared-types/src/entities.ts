// Core domain types shared between the control plane (api), the node agent,
// and the dashboard (web). Keep this package framework-agnostic — no NestJS
// or React imports here, just plain types.

export type Id = string;

export enum NodeKind {
  LOCAL = 'local',
  CLOUD = 'cloud',
}

export enum ServerStatus {
  CREATING = 'creating',
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error',
  DELETING = 'deleting',
}

/** A port a game server container exposes. */
export interface PortMapping {
  /** Port inside the container, e.g. 25565 for Minecraft. */
  containerPort: number;
  protocol: 'tcp' | 'udp';
  /** Human label shown in the dashboard, e.g. "Game port", "RCON". */
  label: string;
}

/**
 * A `PortMapping` plus the actual host port a specific server got assigned
 * on its node — decided once, at creation, by PortAllocatorService
 * (apps/api/src/servers/port-allocator.service.ts) so two servers on the
 * same node never both try to bind the template's default port. `tcp`/`udp`
 * pairs that share one containerPort (e.g. 7 Days to Die's game port) are
 * allocated the same hostPort — see the allocator for why.
 */
export interface PortBinding extends PortMapping {
  hostPort: number;
}

export interface EnvVarOption {
  value: string;
  label: string;
}

/**
 * Describes one configurable env var a template exposes to the user.
 * `select`/`range` exist specifically so "advanced options" can offer real
 * constraints instead of free text a user has to guess at correctly (a
 * Minecraft version that doesn't exist, a memory string Docker rejects,
 * a difficulty that's really an arbitrary string) — see
 * apps/web/src/pages/CreateServerPage.tsx for how each type renders.
 */
export interface EnvVarSchema {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'range';
  default?: string | number | boolean;
  required?: boolean;
  /** Mask in the UI and never log the value (e.g. RCON password). */
  secret?: boolean;
  description?: string;
  /** type: 'select' — the choices to present. */
  options?: EnvVarOption[];
  /** type: 'range' — slider bounds; `default` is the plain numeric position (e.g. 2, not "2G"). */
  min?: number;
  max?: number;
  step?: number;
  /** type: 'range' — suffix appended to the slider's number to form the env value, e.g. "G" turns 3 into "3G". */
  unit?: string;
  /** Included in the built env but not shown in the form — internal/technical settings the user shouldn't need to touch. */
  hidden?: boolean;
}

/** A supported game, defined as a Docker image + its configuration surface. */
export interface GameTemplate {
  id: Id;
  slug: string;
  name: string;
  dockerImage: string;
  ports: PortMapping[];
  envSchema: EnvVarSchema[];
  volumeMounts?: { containerPath: string; label: string }[];
}

/** A host capable of running game server containers — a PC or a cloud VM. */
export interface GameNode {
  id: Id;
  ownerId: Id;
  name: string;
  kind: NodeKind;
  /** Updated on every heartbeat; used to show online/offline in the UI. */
  lastSeenAt?: string;
}

export interface GameServerConfig {
  env: Record<string, string>;
}

/** One running (or stopped) game server instance on a node. */
export interface GameServer {
  id: Id;
  ownerId: Id;
  nodeId: Id;
  templateId: Id;
  name: string;
  status: ServerStatus;
  config: GameServerConfig;
  /** Host ports actually assigned to this server on its node — see PortBinding. */
  ports: PortBinding[];
  createdAt: string;
}
