import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

/** Tạo Nest app trên một express instance (dùng chung cho chạy local và Vercel). */
export async function createApp() {
  const server = express();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
    logger: ['error', 'warn', 'log'],
  });
  app.set('trust proxy', true);
  app.disable('x-powered-by');
  // Giống server cũ: JSON tối đa 5 MB (Vercel giới hạn body 4,5 MB; file lớn upload thẳng lên Blob).
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: false, limit: '5mb' }));
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter());
  if (process.env.CORS_ORIGIN) {
    app.enableCors({ origin: process.env.CORS_ORIGIN.split(','), credentials: true });
  }
  await app.init();
  return { app, server };
}
