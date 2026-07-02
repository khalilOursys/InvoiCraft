import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Correct CORS config for both dev and production
  app.enableCors({
    origin: [
      'http://localhost:8000',
      'http://localhost:3002',
      'https://oralwave.tn',
      'https://admin.oralwave.tn',
      'http://localhost:3000',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Serve static files (e.g., images)
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  await app.listen(3001);
}
bootstrap();
