import { Module } from '@nestjs/common';
import { AgentConnectionService } from './agent-connection.service';

@Module({
  providers: [AgentConnectionService],
})
export class ConnectionModule {}
