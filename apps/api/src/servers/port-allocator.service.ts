import { BadRequestException, Injectable } from '@nestjs/common';
import type { Id, PortBinding, PortMapping } from '@gamenest/shared-types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Picks free host ports for a new server on a given node, so two servers on
 * the same node never both try to bind the template's default port (that
 * used to be the *only* behavior — see docker.service.ts's old comment and
 * the orphaned-container bug it caused). Ports are drawn from a fixed range
 * (PORT_RANGE_START..PORT_RANGE_END) rather than the template's own
 * containerPort, since containerPort is the same for every server of that
 * game and is exactly the value we can no longer reuse host-side.
 *
 * "In use" is derived from every other GameServer row currently on the same
 * node — a server's row (and its `ports`) only disappears once its
 * container is actually deleted (ServersService.remove), so a stopped-but-
 * still-existing server keeps its port reserved rather than releasing it
 * for reuse in a stale-lock kind of way. Nodes are still not persisted
 * (see Design notes in README), so this is scoped by `GameServer.nodeId`,
 * a plain string, not a real FK.
 */
@Injectable()
export class PortAllocatorService {
  private readonly rangeStart = Number(process.env.PORT_RANGE_START ?? 20000);
  private readonly rangeEnd = Number(process.env.PORT_RANGE_END ?? 20999);

  constructor(private readonly prisma: PrismaService) {}

  async allocate(nodeId: Id, ports: PortMapping[]): Promise<PortBinding[]> {
    const used = await this.usedPortsOnNode(nodeId);

    // Ports that share a containerPort number (e.g. 7 Days to Die's game
    // port, exposed as both tcp and udp on 26900) get one host port between
    // them — a player expects one number to connect with, not two.
    const hostPortByContainerPort = new Map<number, number>();
    const bindings: PortBinding[] = [];

    for (const port of ports) {
      let hostPort = hostPortByContainerPort.get(port.containerPort);
      if (hostPort === undefined) {
        hostPort = this.firstFree(used);
        used.add(hostPort);
        hostPortByContainerPort.set(port.containerPort, hostPort);
      }
      bindings.push({ ...port, hostPort });
    }

    return bindings;
  }

  private async usedPortsOnNode(nodeId: Id): Promise<Set<number>> {
    const rows = await this.prisma.gameServer.findMany({
      where: { nodeId },
      select: { ports: true },
    });

    const used = new Set<number>();

    for (const row of rows) {
      const rowPorts = row.ports as unknown as PortBinding[];
      for (const binding of rowPorts) used.add(binding.hostPort);
    }
    return used;
  }

  private firstFree(used: ReadonlySet<number>): number {
    for (
      let candidate = this.rangeStart;
      candidate <= this.rangeEnd;
      candidate++
    ) {
      if (!used.has(candidate)) return candidate;
    }
    throw new BadRequestException(
      `No free ports left on this node (range ${this.rangeStart}-${this.rangeEnd} is fully allocated)`,
    );
  }
}
