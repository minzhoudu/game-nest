import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';
import * as os from 'node:os';
import { io, Socket } from 'socket.io-client';
import {
  AGENT_NAMESPACE,
  AgentToServerMessage,
  HostInfo,
  PROTOCOL_EVENT,
  ServerToAgentMessage,
} from '@gamenest/shared-types';
import { getOrCreateNodeId } from './node-identity';

const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Owns the single outbound connection to the control plane. Connects on
 * boot, registers this node, then heartbeats and waits for commands.
 *
 * This deliberately dials OUT rather than accepting inbound connections —
 * it's what lets this same agent run unmodified behind a home router's NAT
 * or on a cloud VM with a public IP.
 */
@Injectable()
export class AgentConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentConnectionService.name);
  private socket?: Socket;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private nodeId!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.nodeId = this.config.get<string>('NODE_ID') || getOrCreateNodeId();
    const apiUrl = this.config.get<string>('API_URL', 'http://localhost:3000');
    const agentToken = this.config.get<string>('AGENT_TOKEN', '');

    if (!agentToken) {
      this.logger.warn('AGENT_TOKEN is not set — the control plane will reject registration.');
    }

    this.logger.log(`Node id: ${this.nodeId}`);
    this.logger.log(`Connecting to control plane at ${apiUrl}${AGENT_NAMESPACE} ...`);

    this.socket = io(`${apiUrl}${AGENT_NAMESPACE}`, {
      reconnection: true,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => void this.handleConnect(agentToken));
    this.socket.on('disconnect', (reason) => this.logger.warn(`Disconnected from control plane: ${reason}`));
    this.socket.on('connect_error', (err) => this.logger.error(`Connection error: ${err.message}`));
    this.socket.on(PROTOCOL_EVENT, (message: ServerToAgentMessage) => this.handleMessage(message));
  }

  onModuleDestroy(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.socket?.disconnect();
  }

  private async handleConnect(agentToken: string): Promise<void> {
    this.logger.log('Connected — registering node...');
    const hostInfo = await this.collectHostInfo();
    this.send({ type: 'agent.register', nodeId: this.nodeId, agentToken, hostInfo });
  }

  private handleMessage(message: ServerToAgentMessage): void {
    switch (message.type) {
      case 'agent.registered':
        this.logger.log(`Registered with control plane as node ${message.nodeId}`);
        this.startHeartbeat();
        return;
      case 'agent.registrationFailed':
        this.logger.error(`Registration rejected: ${message.reason}`);
        return;
      case 'command.createContainer':
      case 'command.startContainer':
      case 'command.stopContainer':
      case 'command.deleteContainer':
      case 'command.streamLogs':
        // Docker orchestration is the next phase — for now, just prove
        // commands make it from the control plane to the agent intact.
        this.logger.warn(`Received "${message.type}" but Docker orchestration isn't implemented yet.`);
        return;
      default:
        this.logger.warn(`Unhandled control-plane message: ${(message as { type: string }).type}`);
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'agent.heartbeat', nodeId: this.nodeId });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private send(message: AgentToServerMessage): void {
    this.socket?.emit(PROTOCOL_EVENT, message);
  }

  private async collectHostInfo(): Promise<HostInfo> {
    let dockerVersion = 'unknown';
    try {
      const docker = new Docker();
      const version = await docker.version();
      dockerVersion = version.Version;
    } catch {
      this.logger.warn(
        'Could not reach the Docker daemon — is Docker running? Container commands will fail until it is.',
      );
    }

    return {
      os: `${os.platform()} ${os.release()}`,
      arch: os.arch(),
      dockerVersion,
      cpuCount: os.cpus().length,
      totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
    };
  }
}
