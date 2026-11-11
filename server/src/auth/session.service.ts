/**
 * File này: tạo, ký, kiểm tra cookie phiên đăng nhập (như "thẻ ra vào" có chữ ký chống làm giả).
 * Dùng ở: auth.controller (đăng nhập/xuất), auth.guard (kiểm tra mỗi request).
 */
import { Injectable } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';

// Tên cookie và thời hạn phiên (8 giờ).
export const SESSION_COOKIE = 'superwhite.sid';
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

// Nội dung bên trong cookie: id người dùng, mã phiên, hạn dùng.
interface SessionPayload {
  uid: number;
  sid: string;
  exp: number;
}

// Mã hóa sang base64url (dạng chữ an toàn cho cookie/URL).
const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/**
 * Phiên đăng nhập không trạng thái (phù hợp serverless): cookie httpOnly chứa {uid, sid, exp} ký HMAC-SHA256.
 * `sid` được băm sha256 thành `user_sessions.session_key` để có thể thu hồi (đăng xuất) phía server.
 */
@Injectable()
export class SessionService {
  /** Khóa bí mật để ký cookie (biến môi trường SESSION_SECRET, ≥ 32 ký tự). */
  private get secret(): string {
    const s = process.env.SESSION_SECRET;
    if (!s || s.length < 32) throw new Error('SESSION_SECRET phải dài tối thiểu 32 ký tự');
    return s;
  }

  /** Băm mã phiên thành khóa lưu trong DB (DB lộ cũng không dùng được để giả cookie). */
  static sessionKey(sid: string) {
    return createHash('sha256').update(sid).digest('hex');
  }

  /** Sinh mã phiên ngẫu nhiên 32 byte. */
  newSid() {
    return randomBytes(32).toString('hex');
  }

  /** Tạo chuỗi cookie "<nội dung>.<chữ ký>". */
  sign(uid: number, sid: string): string {
    const payload: SessionPayload = { uid, sid, exp: Date.now() + SESSION_MAX_AGE_MS };
    const body = b64url(JSON.stringify(payload));
    // Chữ ký HMAC: chỉ ai có khóa bí mật mới tạo được.
    const mac = createHmac('sha256', this.secret).update(body).digest('base64url');
    return `${body}.${mac}`;
  }

  /** Kiểm tra cookie: chữ ký đúng và chưa hết hạn thì trả nội dung, không thì null. */
  verify(token: string | undefined): SessionPayload | null {
    if (!token || typeof token !== 'string') return null;
    const [body, mac] = token.split('.');
    if (!body || !mac) return null;
    // Tính lại chữ ký và so sánh (so kiểu "thời gian cố định" để chống dò đoán).
    const expected = createHmac('sha256', this.secret).update(body).digest();
    const given = Buffer.from(mac, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    // Giải mã nội dung, kiểm tra đúng kiểu và còn hạn.
    try {
      const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
      if (!p || typeof p.uid !== 'number' || typeof p.sid !== 'string' || !(p.exp > Date.now())) return null;
      return p;
    } catch {
      return null;
    }
  }

  /** Đọc và kiểm tra cookie phiên từ request. */
  read(req: Request) {
    return this.verify((req as any).cookies?.[SESSION_COOKIE]);
  }

  /** Gửi cookie phiên cho trình duyệt. */
  setCookie(res: Response, token: string) {
    res.cookie(SESSION_COOKIE, token, {
      // JavaScript trên trang không đọc được cookie (chống đánh cắp).
      httpOnly: true,
      sameSite: 'lax',
      // Chỉ gửi qua https khi chạy thật / trên Vercel.
      secure: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
      maxAge: SESSION_MAX_AGE_MS,
      path: '/',
    });
  }

  /** Xóa cookie phiên. */
  clearCookie(res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
