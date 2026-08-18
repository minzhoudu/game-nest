import { Module } from '@nestjs/common';
import { NodeRegistryService } from './node-registry.service';
import { NodesController } from './nodes.controller';
import { NodesGateway } from './nodes.gateway';

@Module({
  providers: [NodesGateway, NodeRegistryService],
  controllers: [NodesController],
  exports: [NodeRegistryService],
})
export class NodesModule {}
