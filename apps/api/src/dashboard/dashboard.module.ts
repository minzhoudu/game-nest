import { Module } from '@nestjs/common';
import { NodesModule } from '../nodes/nodes.module';
import { ServersModule } from '../servers/servers.module';
import { DashboardGateway } from './dashboard.gateway';

@Module({
  imports: [NodesModule, ServersModule],
  providers: [DashboardGateway],
})
export class DashboardModule {}
