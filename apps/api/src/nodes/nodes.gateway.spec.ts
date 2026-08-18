import { ServerStatus } from '@gamenest/shared-types';
import {
  AGENT_COMMAND_ACK,
  AGENT_COMMAND_ERROR,
  AGENT_CONTAINER_LOG,
  AGENT_CONTAINER_STATUS,
} from './agent-events';
import { NodesGateway } from './nodes.gateway';
import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { NodeRegistryService } from './node-registry.service';

const AGENT_TOKEN = 'dev-shared-secret';

describe('NodesGateway', () => {
  let registry: { register: jest.Mock; touchHeartbeat: jest.Mock };
  let config: { get: jest.Mock };
  let events: { emit: jest.Mock };
  let gateway: NodesGateway;
  let client: { id: string; emit: jest.Mock; disconnect: jest.Mock };

  beforeEach(() => {
    registry = { register: jest.fn(), touchHeartbeat: jest.fn() };
    config = { get: jest.fn().mockReturnValue(AGENT_TOKEN) };
    events = { emit: jest.fn() };
    client = { id: 'socket-1', emit: jest.fn(), disconnect: jest.fn() };
    gateway = new NodesGateway(
      registry as unknown as NodeRegistryService,
      config as unknown as ConfigService,
      events as unknown as EventEmitter2,
    );
  });

  const hostInfo = {
    os: 'win32',
    arch: 'x64',
    dockerVersion: '28.0.0',
    cpuCount: 8,
    totalMemoryMb: 16000,
  };

  it('registers a node that presents the correct token', () => {
    gateway.handleMessage(client as never, {
      type: 'agent.register',
      nodeId: 'node-1',
      agentToken: AGENT_TOKEN,
      hostInfo,
    });

    expect(registry.register).toHaveBeenCalledWith('node-1', client, hostInfo);
    expect(client.emit).toHaveBeenCalledWith('message', {
      type: 'agent.registered',
      nodeId: 'node-1',
    });
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('rejects and disconnects a node with the wrong token', () => {
    gateway.handleMessage(client as never, {
      type: 'agent.register',
      nodeId: 'node-1',
      agentToken: 'wrong-token',
      hostInfo,
    });

    expect(registry.register).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('message', {
      type: 'agent.registrationFailed',
      reason: 'Invalid agent token',
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('rejects registration when no secret is configured server-side (fails closed, not open)', () => {
    config.get.mockReturnValue(undefined);

    gateway.handleMessage(client as never, {
      type: 'agent.register',
      nodeId: 'node-1',
      agentToken: AGENT_TOKEN,
      hostInfo,
    });

    expect(registry.register).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('routes a heartbeat to the registry', () => {
    gateway.handleMessage(client as never, {
      type: 'agent.heartbeat',
      nodeId: 'node-1',
    });
    expect(registry.touchHeartbeat).toHaveBeenCalledWith('node-1');
  });

  it('re-emits container.status/log and command.ack/error as internal events', () => {
    gateway.handleMessage(client as never, {
      type: 'container.status',
      serverId: 's1',
      status: ServerStatus.RUNNING,
    });
    expect(events.emit).toHaveBeenCalledWith(AGENT_CONTAINER_STATUS, {
      serverId: 's1',
      status: ServerStatus.RUNNING,
    });

    gateway.handleMessage(client as never, {
      type: 'container.log',
      serverId: 's1',
      line: 'Done!',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(events.emit).toHaveBeenCalledWith(AGENT_CONTAINER_LOG, {
      serverId: 's1',
      line: 'Done!',
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    gateway.handleMessage(client as never, {
      type: 'command.ack',
      requestId: 'r1',
    });
    expect(events.emit).toHaveBeenCalledWith(AGENT_COMMAND_ACK, {
      requestId: 'r1',
    });

    gateway.handleMessage(client as never, {
      type: 'command.error',
      requestId: 'r2',
      message: 'boom',
    });
    expect(events.emit).toHaveBeenCalledWith(AGENT_COMMAND_ERROR, {
      requestId: 'r2',
      message: 'boom',
    });
  });

  it('forgets the owning node on disconnect', () => {
    const unregisterBySocketId = jest.fn().mockReturnValue('node-1');
    (
      registry as unknown as { unregisterBySocketId: jest.Mock }
    ).unregisterBySocketId = unregisterBySocketId;

    gateway.handleDisconnect(client as never);

    expect(unregisterBySocketId).toHaveBeenCalledWith('socket-1');
  });
});
