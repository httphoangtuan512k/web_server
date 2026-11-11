import type { NextApiRequest, NextApiResponse } from "next";
import { getHandler } from "../../server/src/serverless";

/** Mọi request /api/* được xử lý bởi NestJS ngay trong ứng dụng Next.js (1 project, 1 domain). */
export const config = {
  api: { bodyParser: false, externalResolver: true, responseLimit: false },
};

export default async function api(req: NextApiRequest, res: NextApiResponse) {
  const handler = await getHandler();
  await new Promise<void>((resolve) => {
    res.on("finish", resolve);
    res.on("close", resolve);
    handler(req, res);
  });
}
