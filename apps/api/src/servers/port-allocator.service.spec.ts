import { BadRequestException } from '@nestjs/common';
import type { PortMapping } from '@gamenest/shared-types';
import { PortAllocatorService } from './port-allocator.service';
import type { PrismaService } from '../prisma/prisma.service';

const MINECRAFT_PORTS: PortMapping[] = [
  { containerPort: 25565, protocol: 'tcp', label: 'Game port' },
];

const SEVEN_DTD_PORTS: PortMapping[] = [
  { containerPort: 26900, protocol: 'tcp', label: 'Game port (TCP)' },
  { containerPort: 26900, protocol: 'udp', label: 'Game port (UDP)' },
];

describe('PortAllocatorService', () => {
  let prisma: { gameServer: { findMany: jest.Mock } };
  let service: PortAllocatorService;

  beforeEach(() => {
    process.env.PORT_RANGE_START = '20000';
    process.env.PORT_RANGE_END = '20002';
    prisma = { gameServer: { findMany: jest.fn() } };
    service = new PortAllocatorService(prisma as unknown as PrismaService);
  });

  it('gives the first port in the range when nothing else is allocated on the node', async () => {
    prisma.gameServer.findMany.mockResolvedValue([]);

    const bindings = await service.allocate('node-1', MINECRAFT_PORTS);

    expect(bindings).toEqual([{ ...MINECRAFT_PORTS[0], hostPort: 20000 }]);
  });

  it('skips ports already used by another server on the same node', async () => {
    prisma.gameServer.findMany.mockResolvedValue([
      {
        ports: [
          {
            containerPort: 25565,
            protocol: 'tcp',
            label: 'x',
            hostPort: 20000,
          },
        ],
      },
    ]);

    const bindings = await service.allocate('node-1', MINECRAFT_PORTS);

    expect(bindings[0].hostPort).toBe(20001);
  });

  it('only queries ports for the requested node, so a busy port on a different node is still free here', async () => {
    prisma.gameServer.findMany.mockResolvedValue([]);

    await service.allocate('node-1', MINECRAFT_PORTS);

    expect(prisma.gameServer.findMany).toHaveBeenCalledWith({
      where: { nodeId: 'node-1' },
      select: { ports: true },
    });
  });

  it('assigns the same host port to a tcp/udp pair that share one containerPort', async () => {
    prisma.gameServer.findMany.mockResolvedValue([]);

    const bindings = await service.allocate('node-1', SEVEN_DTD_PORTS);

    expect(bindings).toHaveLength(2);
    expect(bindings[0].hostPort).toBe(bindings[1].hostPort);
  });

  it('throws when the range is fully allocated', async () => {
    prisma.gameServer.findMany.mockResolvedValue([
      {
        ports: [
          { containerPort: 1, protocol: 'tcp', label: 'a', hostPort: 20000 },
        ],
      },
      {
        ports: [
          { containerPort: 1, protocol: 'tcp', label: 'b', hostPort: 20001 },
        ],
      },
      {
        ports: [
          { containerPort: 1, protocol: 'tcp', label: 'c', hostPort: 20002 },
        ],
      },
    ]);

    await expect(service.allocate('node-1', MINECRAFT_PORTS)).rejects.toThrow(
      BadRequestException,
    );
  });
});
