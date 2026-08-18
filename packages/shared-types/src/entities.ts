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

/** Describes one configurable env var a template exposes to the user. */
export interface EnvVarSchema {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean';
  default?: string | number | boolean;
  required?: boolean;
  /** Mask in the UI and never log the value (e.g. RCON password). */
  secret?: boolean;
  description?: string;
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
  createdAt: string;
}
