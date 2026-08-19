import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { PROTOCOL_EVENT } from '@gamenest/shared-types';
import type { Id, ServerToAgentMessage } from '@gamenest/shared-types';
import {
  AGENT_COMMAND_ACK,
  AGENT_COMMAND_ERROR,
} from '../events/internal-events';
import type {
  AgentCommandAckEvent,
  AgentCommandErrorEvent,
} from '../events/internal-events';
import { NodeRegistryService } from './node-registry.service';

export const COMMAND_TIMEOUT_MS = 30_000;

interface PendingCommand {
  resolve: () => void;
  reject: (err: Error) => void;
}

// Plain `Omit<Union, K>` isn't distributive — it collapses a discriminated
// union down to only its *common* keys, which would let callers pass a
// command.createContainer without dockerImage/ports/config and still
// type-check. This distributes Omit over each member first.
type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

type Command = DistributiveOmit<
  Extract<ServerToAgentMessage, { requestId: Id }>,
  'requestId'
>;

/**
 * Turns the fire-and-forget agent socket into request/response: send() sends
 * a command down a node's socket and returns a Promise that resolves on the
 * matching command.ack (or rejects on command.error / timeout). NodesGateway
 * emits those as internal-events.ts events as they arrive; the @OnEvent
 * handlers below feed them back into whichever send() is still waiting.
 */
@Injectable()
export class NodeCommandService {
  private readonly logger = new Logger(NodeCommandService.name);
  private readonly pending = new Map<Id, PendingCommand>();

  constructor(private readonly registry: NodeRegistryService) {}

  async send(nodeId: Id, message: Command): Promise<void> {
    const socket = this.registry.getSocket(nodeId);
    if (!socket) {
      throw new Error(`Node ${nodeId} is not connected`);
    }

    const requestId = randomUUID();
    const fullMessage = { ...message, requestId } as ServerToAgentMessage;

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(
          new Error(
            `Command ${message.type} timed out waiting for node ${nodeId}`,
          ),
        );
      }, COMMAND_TIMEOUT_MS);

      this.pending.set(requestId, {
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      socket.emit(PROTOCOL_EVENT, fullMessage);
    });
  }

  @OnEvent(AGENT_COMMAND_ACK)
  private handleAck(event: AgentCommandAckEvent): void {
    const pending = this.pending.get(event.requestId);
    if (!pending) return;
    this.pending.delete(event.requestId);
    pending.resolve();
  }

  @OnEvent(AGENT_COMMAND_ERROR)
  private handleError(event: AgentCommandErrorEvent): void {
    const pending = this.pending.get(event.requestId);
    if (!pending) {
      this.logger.warn(
        `command.error for unknown/expired request ${event.requestId}: ${event.message}`,
      );
      return;
    }
    this.pending.delete(event.requestId);
    pending.reject(new Error(event.message));
  }
}
