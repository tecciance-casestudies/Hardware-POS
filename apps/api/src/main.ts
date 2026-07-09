import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { API_VERSION } from '@hardware-pos/shared';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix(API_VERSION);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  const port = config.get<number>('API_PORT', 4000);
  await app.listen(port);

  Logger.log(`Hardware POS API listening on http://localhost:${port}/${API_VERSION}`, 'Bootstrap');
}

void bootstrap();
