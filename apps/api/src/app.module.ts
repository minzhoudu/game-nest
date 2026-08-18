import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NodesModule } from './nodes/nodes.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), NodesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
