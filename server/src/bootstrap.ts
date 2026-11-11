/**
 * File này: khởi động API NestJS trên Express, gắn bộ đọc JSON/cookie và bộ bắt lỗi chung.
 * Dùng ở: server/src/serverless.ts (gọi createApp() một lần).
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

/** Tạo Nest app trên một express instance (dùng chung cho chạy local và Vercel). Trả về { app, server }. */
export async function createApp() {
  // Tạo máy chủ Express rồi dựng NestJS chạy trên nó.
  const server = express();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(server), {
    // Tắt bộ đọc body mặc định – bên dưới tự gắn bộ đọc có giới hạn 5 MB.
    bodyParser: false,
    logger: ['error', 'warn', 'log'],
  });
  // Tin proxy của Vercel (lấy đúng IP người dùng) và ẩn header lộ công nghệ.
  app.set('trust proxy', true);
  app.disable('x-powered-by');
  // Giống server cũ: JSON tối đa 5 MB (Vercel giới hạn body 4,5 MB; file lớn upload thẳng lên Blob).
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: false, limit: '5mb' }));
  // Đọc cookie (chứa phiên đăng nhập) vào req.cookies.
  app.use(cookieParser());
  // Mọi lỗi đều trả về dạng { error: "..." }.
  app.useGlobalFilters(new HttpExceptionFilter());
  // Chỉ bật CORS (cho tên miền khác gọi API) khi có cấu hình CORS_ORIGIN.
  if (process.env.CORS_ORIGIN) {
    app.enableCors({ origin: process.env.CORS_ORIGIN.split(','), credentials: true });
  }
  await app.init();
  return { app, server };
}
