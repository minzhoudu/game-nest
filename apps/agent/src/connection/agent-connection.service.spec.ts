import { ServerStatus } from '@gamenest/shared-types';
import type { AgentToServerMessage } from '@gamenest/shared-types';
import type { ConfigService } from '@nestjs/config';
import { AgentConnectionService } from './agent-connection.service';
import type { DockerService } from '../docker/docker.service';

type Handle = (message: AgentToServerMessage) => Promise<void>;

describe('AgentConnectionService', () => {
  let docker: {
    createContainer: jest.Mock;
    startContainer: jest.Mock;
    stopContainer: jest.Mock;
    restartContainer: jest.Mock;
    deleteContainer: jest.Mock;
    streamLogs: jest.Mock;
  };
  let service: AgentConnectionService;
  let sent: unknown[];
  let handleMessage: Handle;

  beforeEach(() => {
    docker = {
      createContainer: jest.fn().mockResolvedValue(undefined),
      startContainer: jest.fn().mockResolvedValue(undefined),
      stopContainer: jest.fn().mockResolvedValue(undefined),
      restartContainer: jest.fn().mockResolvedValue(undefined),
      deleteContainer: jest.fn().mockResolvedValue(undefined),
      streamLogs: jest.fn().mockResolvedValue(() => {}),
    };
    const config = { get: jest.fn() } as unknown as ConfigService;
    service = new AgentConnectionService(
      config,
      docker as unknown as DockerService,
    );

    sent = [];
    (
      service as unknown as {
        socket: { emit: (event: string, message: unknown) => void };
      }
    ).socket = {
      emit: (_event, message) => sent.push(message),
    };
    const internal = service as unknown as { handleMessage: Handle };
    handleMessage = (message) => internal.handleMessage(message);
  });

  it('creates a container then reports it stopped and acks', async () => {
    await handleMessage({
      type: 'command.createContainer',
      requestId: 'r1',
      serverId: 's1',
      dockerImage: 'itzg/minecraft-server',
      ports: [],
      config: { env: {} },
    });

    expect(docker.createContainer).toHaveBeenCalledWith(
      's1',
      'itzg/minecraft-server',
      [],
      { env: {} },
    );
    expect(sent).toEqual([
      {
        type: 'container.status',
        serverId: 's1',
        status: ServerStatus.STOPPED,
      },
      { type: 'command.ack', requestId: 'r1' },
    ]);
  });

  it('starting a container reports starting then running, in order', async () => {
    await handleMessage({
      type: 'command.startContainer',
      requestId: 'r2',
      serverId: 's1',
    });

    expect(docker.startContainer).toHaveBeenCalledWith('s1');
    expect(sent).toEqual([
      {
        type: 'container.status',
        serverId: 's1',
        status: ServerStatus.STARTING,
      },
      {
        type: 'container.status',
        serverId: 's1',
        status: ServerStatus.RUNNING,
      },
      { type: 'command.ack', requestId: 'r2' },
    ]);
  });

  it('stopping a container reports stopping then stopped', async () => {
    await handleMessage({
      type: 'command.stopContainer',
      requestId: 'r3',
      serverId: 's1',
    });

    expect(docker.stopContainer).toHaveBeenCalledWith('s1');
    expect(sent).toEqual([
      {
        type: 'container.status',
        serverId: 's1',
        status: ServerStatus.STOPPING,
      },
      {
        type: 'container.status',
        serverId: 's1',
        status: ServerStatus.STOPPED,
      },
      { type: 'command.ack', requestId: 'r3' },
    ]);
  });

  it('restarting a container reports starting then running, in order (one Docker call, not stop+start)', async () => {
    await handleMessage({
      type: 'command.restartContainer',
      requestId: 'r6',
      serverId: 's1',
    });

    expect(docker.restartContainer).toHaveBeenCalledWith('s1');
    expect(docker.stopContainer).not.toHaveBeenCalled();
    expect(docker.startContainer).not.toHaveBeenCalled();
    expect(sent).toEqual([
      {
        type: 'container.status',
        serverId: 's1',
        status: ServerStatus.STARTING,
      },
      {
        type: 'container.status',
        serverId: 's1',
        status: ServerStatus.RUNNING,
      },
      { type: 'command.ack', requestId: 'r6' },
    ]);
  });

  it('sends command.error instead of throwing when Docker fails', async () => {
    docker.startContainer.mockRejectedValue(new Error('container not found'));

    await expect(
      handleMessage({
        type: 'command.startContainer',
        requestId: 'r4',
        serverId: 's1',
      }),
    ).resolves.toBeUndefined();

    expect(sent).toContainEqual({
      type: 'command.error',
      requestId: 'r4',
      message: 'container not found',
    });
    expect(sent).not.toContainEqual(
      expect.objectContaining({ type: 'command.ack' }),
    );
  });

  it('deleting a container reports deleting then acks, without a redundant status after', async () => {
    await handleMessage({
      type: 'command.deleteContainer',
      requestId: 'r5',
      serverId: 's1',
    });

    expect(docker.deleteContainer).toHaveBeenCalledWith('s1');
    expect(sent).toEqual([
      {
        type: 'container.status',
        serverId: 's1',
        status: ServerStatus.DELETING,
      },
      { type: 'command.ack', requestId: 'r5' },
    ]);
  });
});
