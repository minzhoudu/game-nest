import { COMMAND_TIMEOUT_MS, NodeCommandService } from './node-command.service';
import type { NodeRegistryService } from './node-registry.service';

describe('NodeCommandService', () => {
  let registry: { getSocket: jest.Mock };
  let socket: { emit: jest.Mock };
  let service: NodeCommandService;

  beforeEach(() => {
    socket = { emit: jest.fn() };
    registry = { getSocket: jest.fn().mockReturnValue(socket) };
    service = new NodeCommandService(
      registry as unknown as NodeRegistryService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function lastEmittedRequestId(): string {
    const [, message] = socket.emit.mock.calls[
      socket.emit.mock.calls.length - 1
    ] as [string, { requestId: string }];
    return message.requestId;
  }

  it('resolves send() when a matching command.ack arrives', async () => {
    const pending = service.send('node-1', {
      type: 'command.startContainer',
      serverId: 's1',
    });
    const requestId = lastEmittedRequestId();

    (
      service as unknown as { handleAck: (e: { requestId: string }) => void }
    ).handleAck({ requestId });

    await expect(pending).resolves.toBeUndefined();
  });

  it('rejects send() when a matching command.error arrives', async () => {
    const pending = service.send('node-1', {
      type: 'command.startContainer',
      serverId: 's1',
    });
    const requestId = lastEmittedRequestId();

    (
      service as unknown as {
        handleError: (e: { requestId: string; message: string }) => void;
      }
    ).handleError({
      requestId,
      message: 'container not found',
    });

    await expect(pending).rejects.toThrow('container not found');
  });

  it('rejects immediately when the node has no connected socket', async () => {
    registry.getSocket.mockReturnValue(undefined);

    await expect(
      service.send('missing-node', {
        type: 'command.startContainer',
        serverId: 's1',
      }),
    ).rejects.toThrow('missing-node is not connected');
  });

  it('rejects with a timeout if no ack/error ever arrives', async () => {
    jest.useFakeTimers();
    const pending = service.send('node-1', {
      type: 'command.startContainer',
      serverId: 's1',
    });
    // Attach a rejection handler before advancing timers so Jest doesn't
    // complain about an unhandled rejection in the window before we await it.
    const assertion = expect(pending).rejects.toThrow('timed out');

    jest.advanceTimersByTime(COMMAND_TIMEOUT_MS);

    await assertion;
  });

  it('ignores an ack/error for an unknown or already-settled requestId', () => {
    expect(() =>
      (
        service as unknown as { handleAck: (e: { requestId: string }) => void }
      ).handleAck({
        requestId: 'never-sent',
      }),
    ).not.toThrow();
    expect(() =>
      (
        service as unknown as {
          handleError: (e: { requestId: string; message: string }) => void;
        }
      ).handleError({
        requestId: 'never-sent',
        message: 'whatever',
      }),
    ).not.toThrow();
  });
});
