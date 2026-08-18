import { Injectable, Logger } from '@nestjs/common';
import Docker from 'dockerode';
import { PassThrough } from 'node:stream';
import { GameServerConfig, PortMapping } from '@gamenest/shared-types';

/**
 * Executes the Docker side of ServerToAgentMessage commands. One container
 * per game server, named `gamenest-<serverId>` — that naming is also how we
 * find a server's container again after an agent restart, since we don't
 * persist the id mapping (nothing here survives a restart by design; the
 * control plane owns the durable truth once GameServer is persisted).
 */
@Injectable()
export class DockerService {
  private readonly logger = new Logger(DockerService.name);
  private readonly docker = new Docker();

  async createContainer(
    serverId: string,
    dockerImage: string,
    ports: PortMapping[],
    config: GameServerConfig,
  ): Promise<void> {
    await this.ensureImage(dockerImage);

    const exposedPorts: Record<string, object> = {};
    const portBindings: Record<string, Array<{ HostPort: string }>> = {};
    for (const port of ports) {
      const key = `${port.containerPort}/${port.protocol}`;
      exposedPorts[key] = {};
      // MVP: host port == container port, so only one server per port per
      // node at a time. Fine for "you + friends" on one node; will need real
      // port allocation once multiple servers of the same game share a node.
      portBindings[key] = [{ HostPort: `${port.containerPort}` }];
    }

    const env = Object.entries(config.env).map(
      ([key, value]) => `${key}=${value}`,
    );

    this.logger.log(
      `Creating container for server ${serverId} (${dockerImage})`,
    );
    await this.docker.createContainer({
      name: this.containerName(serverId),
      Image: dockerImage,
      Env: env,
      ExposedPorts: exposedPorts,
      // Tty:true keeps the log stream a single plain byte stream instead of
      // Docker's multiplexed stdout/stderr frame format — much simpler to
      // tail line-by-line, and game server daemons don't mind.
      Tty: true,
      HostConfig: {
        PortBindings: portBindings,
        RestartPolicy: { Name: 'unless-stopped' },
      },
    });
  }

  async startContainer(serverId: string): Promise<void> {
    this.logger.log(`Starting container for server ${serverId}`);
    await this.getContainer(serverId).start();
  }

  async stopContainer(serverId: string): Promise<void> {
    this.logger.log(`Stopping container for server ${serverId}`);
    await this.getContainer(serverId).stop();
  }

  async deleteContainer(serverId: string): Promise<void> {
    this.logger.log(`Deleting container for server ${serverId}`);
    await this.getContainer(serverId).remove({ force: true });
  }

  /** Tails logs, calling onLine for each line. Returns a function that stops the tail. */
  async streamLogs(
    serverId: string,
    onLine: (line: string) => void,
  ): Promise<() => void> {
    const container = this.getContainer(serverId);
    const stream = (await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: 100,
    })) as NodeJS.ReadableStream;

    const lines = new PassThrough();
    stream.pipe(lines);
    let buffer = '';
    lines.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf-8');
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) onLine(line);
    });

    return () => {
      if (typeof (stream as { destroy?: () => void }).destroy === 'function') {
        (stream as unknown as { destroy: () => void }).destroy();
      }
    };
  }

  private getContainer(serverId: string): Docker.Container {
    return this.docker.getContainer(this.containerName(serverId));
  }

  private containerName(serverId: string): string {
    return `gamenest-${serverId}`;
  }

  private async ensureImage(image: string): Promise<void> {
    const existing = await this.docker.listImages({
      filters: { reference: [image] },
    });
    if (existing.length > 0) return;

    this.logger.log(
      `Pulling image ${image} — this can take a while the first time...`,
    );
    await new Promise<void>((resolve, reject) => {
      this.docker.pull(
        image,
        (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) return reject(err);
          this.docker.modem.followProgress(stream, (err2: Error | null) =>
            err2 ? reject(err2) : resolve(),
          );
        },
      );
    });
    this.logger.log(`Pulled ${image}`);
  }
}
