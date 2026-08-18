import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Only used for local health checks — the agent's real job is the
  // outbound WebSocket connection to the control plane (see API_URL below).
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
