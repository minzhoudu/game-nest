import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // The WS gateway (agent-facing) has its own CORS config — this is for the
  // web dashboard's plain REST calls (GET/POST /nodes, /templates, /servers).
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
