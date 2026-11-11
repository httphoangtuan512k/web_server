/**
 * File này: cửa ngõ API – mọi request /api/* được chuyển nguyên sang NestJS xử lý.
 * Dùng ở: Next.js tự gọi khi có request tới /api/... (tên [...path] = bắt mọi đường con).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getHandler } from "../../server/src/serverless";

/** Mọi request /api/* được xử lý bởi NestJS ngay trong ứng dụng Next.js (1 project, 1 domain). */
// Tắt xử lý body và giới hạn response của Next.js – để NestJS tự lo.
export const config = {
  api: { bodyParser: false, externalResolver: true, responseLimit: false },
};

/** Giao request cho NestJS và chờ đến khi response gửi xong. */
export default async function api(req: NextApiRequest, res: NextApiResponse) {
  const handler = await getHandler();
  // Chờ response gửi xong hoặc kết nối bị đóng.
  await new Promise<void>((resolve) => {
    res.on("finish", resolve);
    res.on("close", resolve);
    handler(req, res);
  });
}
