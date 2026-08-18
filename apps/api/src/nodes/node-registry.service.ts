import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { HostInfo, Id } from '@gamenest/shared-types';

export interface ConnectedNode {
  nodeId: Id;
  socket: Socket;
  hostInfo: HostInfo;
  connectedAt: string;
  lastSeenAt: string;
}

/**
 * In-memory registry of currently-connected agents, keyed by nodeId.
 *
 * MVP-only: this lives purely in process memory, so a control-plane restart
 * forgets every node until each agent reconnects and re-registers (which
 * socket.io-client does automatically). Once Postgres is wired up, this
 * becomes the live/online view backed by a persisted Node table.
 */
@Injectable()
export class NodeRegistryService {
  private readonly logger = new Logger(NodeRegistryService.name);
  private readonly nodes = new Map<Id, ConnectedNode>();

  register(nodeId: Id, socket: Socket, hostInfo: HostInfo): void {
    const now = new Date().toISOString();
    this.nodes.set(nodeId, { nodeId, socket, hostInfo, connectedAt: now, lastSeenAt: now });
  }

  touchHeartbeat(nodeId: Id): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      this.logger.warn(`Heartbeat from unregistered node ${nodeId}`);
      return;
    }
    node.lastSeenAt = new Date().toISOString();
  }

  /** Removes whichever node owns this socket (on disconnect). Returns its id, if any. */
  unregisterBySocketId(socketId: string): Id | undefined {
    for (const [nodeId, node] of this.nodes) {
      if (node.socket.id === socketId) {
        this.nodes.delete(nodeId);
        return nodeId;
      }
    }
    return undefined;
  }

  getSocket(nodeId: Id): Socket | undefined {
    return this.nodes.get(nodeId)?.socket;
  }

  list(): Array<Omit<ConnectedNode, 'socket'>> {
    return [...this.nodes.values()].map(({ socket: _socket, ...rest }) => rest);
  }
}
