import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NodeCommandService } from './node-command.service';
import { NodeRegistryService } from './node-registry.service';
import { NodesController } from './nodes.controller';
import { NodesGateway } from './nodes.gateway';

@Module({
  imports: [AuthModule],
  providers: [NodesGateway, NodeRegistryService, NodeCommandService],
  controllers: [NodesController],
  exports: [NodeRegistryService, NodeCommandService],
})
export class NodesModule {}
