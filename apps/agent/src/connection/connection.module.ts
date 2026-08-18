import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { AgentConnectionService } from './agent-connection.service';

@Module({
  imports: [DockerModule],
  providers: [AgentConnectionService],
})
export class ConnectionModule {}
