import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NodesModule } from '../nodes/nodes.module';
import { TemplatesModule } from '../templates/templates.module';
import { PortAllocatorService } from './port-allocator.service';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';

@Module({
  imports: [AuthModule, NodesModule, TemplatesModule],
  controllers: [ServersController],
  providers: [ServersService, PortAllocatorService],
  exports: [ServersService],
})
export class ServersModule {}
