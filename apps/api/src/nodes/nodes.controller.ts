import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NodeRegistryService } from './node-registry.service';

@Controller('nodes')
@UseGuards(JwtAuthGuard)
export class NodesController {
  constructor(private readonly registry: NodeRegistryService) {}

  /** Currently-connected nodes. Useful for smoke-testing the agent handshake. */
  @Get()
  list() {
    return this.registry.list();
  }
}
