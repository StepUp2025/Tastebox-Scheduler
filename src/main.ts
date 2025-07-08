import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  Logger.log('Schedular application context started.', 'Bootstrap');
  app.enableShutdownHooks();
}

bootstrap();
