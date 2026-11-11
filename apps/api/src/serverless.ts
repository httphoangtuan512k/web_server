import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from './bootstrap';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let cached: Promise<Handler> | null = null;

/** Handler cho Vercel Function: khởi tạo Nest 1 lần rồi tái sử dụng giữa các request. */
export function getHandler(): Promise<Handler> {
  if (!cached) {
    cached = createApp().then(({ server }) => server as unknown as Handler);
    cached.catch(() => (cached = null));
  }
  return cached;
}
