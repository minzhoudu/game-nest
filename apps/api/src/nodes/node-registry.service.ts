import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { HostInfo, Id, NodeSummary } from '@gamenest/shared-types';

export interface ConnectedNode extends NodeSummary {
  socket: Socket;
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

  /** Returns the summary just recorded — callers use it to broadcast a node.connected event. */
  register(nodeId: Id, socket: Socket, hostInfo: HostInfo): NodeSummary {
    const now = new Date().toISOString();
    const node: ConnectedNode = {
      nodeId,
      socket,
      hostInfo,
      connectedAt: now,
      lastSeenAt: now,
    };
    this.nodes.set(nodeId, node);
    return this.toSummary(node);
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

  list(): NodeSummary[] {
    return [...this.nodes.values()].map((node) => this.toSummary(node));
  }

  private toSummary(node: ConnectedNode): NodeSummary {
    return {
      nodeId: node.nodeId,
      hostInfo: node.hostInfo,
      connectedAt: node.connectedAt,
      lastSeenAt: node.lastSeenAt,
    };
  }
}
