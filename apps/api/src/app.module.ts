import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NodesModule } from './nodes/nodes.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServersModule } from './servers/servers.module';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    NodesModule,
    TemplatesModule,
    ServersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
