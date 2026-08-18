import { Controller, Get } from '@nestjs/common';
import { NodeRegistryService } from './node-registry.service';

@Controller('nodes')
export class NodesController {
  constructor(private readonly registry: NodeRegistryService) {}

  /** Currently-connected nodes. Useful for smoke-testing the agent handshake. */
  @Get()
  list() {
    return this.registry.list();
  }
}
