import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConnectionModule } from './connection/connection.module';
import { DockerModule } from './docker/docker.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DockerModule, ConnectionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
