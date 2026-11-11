import { Injectable } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';

export const SESSION_COOKIE = 'superwhite.sid';
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

interface SessionPayload {
  uid: number;
  sid: string;
  exp: number;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/**
 * Phiên đăng nhập không trạng thái (phù hợp serverless): cookie httpOnly chứa {uid, sid, exp} ký HMAC-SHA256.
 * `sid` được băm sha256 thành `login_sessions.session_key` để có thể thu hồi (đăng xuất) phía server.
 */
@Injectable()
export class SessionService {
  private get secret(): string {
    const s = process.env.SESSION_SECRET;
    if (!s || s.length < 32) throw new Error('SESSION_SECRET phải dài tối thiểu 32 ký tự');
    return s;
  }

  static sessionKey(sid: string) {
    return createHash('sha256').update(sid).digest('hex');
  }

  newSid() {
    return randomBytes(32).toString('hex');
  }

  sign(uid: number, sid: string): string {
    const payload: SessionPayload = { uid, sid, exp: Date.now() + SESSION_MAX_AGE_MS };
    const body = b64url(JSON.stringify(payload));
    const mac = createHmac('sha256', this.secret).update(body).digest('base64url');
    return `${body}.${mac}`;
  }

  verify(token: string | undefined): SessionPayload | null {
    if (!token || typeof token !== 'string') return null;
    const [body, mac] = token.split('.');
    if (!body || !mac) return null;
    const expected = createHmac('sha256', this.secret).update(body).digest();
    const given = Buffer.from(mac, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
      const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
      if (!p || typeof p.uid !== 'number' || typeof p.sid !== 'string' || !(p.exp > Date.now())) return null;
      return p;
    } catch {
      return null;
    }
  }

  read(req: Request) {
    return this.verify((req as any).cookies?.[SESSION_COOKIE]);
  }

  setCookie(res: Response, token: string) {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
      maxAge: SESSION_MAX_AGE_MS,
      path: '/',
    });
  }

  clearCookie(res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
