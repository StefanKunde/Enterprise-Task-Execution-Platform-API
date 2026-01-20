import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { Logger } from 'nestjs-pino';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    autoFlushLogs: true,
  });

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:4200'],
    credentials: true,
  });

  app.use(express.json());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true, // wichtig für Klassen-Validierung
    }),
  );

  const logger = await app.resolve(Logger);
  app.useLogger(logger);
  app.use(cookieParser());
  app.useGlobalFilters(app.get(AllExceptionsFilter));

  await app.startAllMicroservices();

  const prefix = 'api';
  app.setGlobalPrefix(prefix);

  // ✅ Start the server
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
