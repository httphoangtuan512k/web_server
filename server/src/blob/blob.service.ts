import { Injectable } from '@nestjs/common';
import { del, get, list, put } from '@vercel/blob';
import { createHash } from 'crypto';

/** Tiền tố đường dẫn công khai trong app; file thật nằm ở Vercel Blob (store private). */
export const FILES_PREFIX = '/api/files/';

/** Các thư mục được phép trên Blob. */
export type BlobFolder = 'orders' | 'maintenance' | 'avatars' | 'documents' | 'backups' | 'baotri-exports';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
};

@Injectable()
export class BlobService {
  /** '/api/files/orders/a.jpg' -> 'orders/a.jpg'. Trả về null nếu không phải file của app. */
  static pathnameFromAppUrl(value: unknown): string | null {
    if (typeof value !== 'string' || !value.startsWith(FILES_PREFIX)) return null;
    return decodeURIComponent(value.slice(FILES_PREFIX.length));
  }

  static appUrl(pathname: string): string {
    return FILES_PREFIX + pathname.split('/').map(encodeURIComponent).join('/');
  }

  async put(pathname: string, body: Buffer | string, contentType?: string, opts: { random?: boolean } = {}) {
    const res = await put(pathname, body, {
      access: 'private',
      addRandomSuffix: opts.random ?? true,
      allowOverwrite: opts.random === false,
      contentType,
    });
    return { pathname: res.pathname, url: res.url, appUrl: BlobService.appUrl(res.pathname) };
  }

  /** Đọc file (stream) theo pathname; null nếu không tồn tại. */
  async get(pathname: string) {
    return get(pathname, { access: 'private' });
  }

  async readBuffer(pathname: string): Promise<Buffer | null> {
    const r = await this.get(pathname);
    if (!r || !r.stream) return null;
    const chunks: Buffer[] = [];
    const reader = (r.stream as ReadableStream<Uint8Array>).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  async list(prefix: string) {
    const blobs: Array<{ pathname: string; size: number; uploadedAt: Date; url: string }> = [];
    let cursor: string | undefined;
    do {
      const r = await list({ prefix, cursor, limit: 1000 });
      blobs.push(...r.blobs.map((b) => ({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt, url: b.url })));
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return blobs;
  }

  async delete(pathnameOrUrl: string | string[]) {
    const items = (Array.isArray(pathnameOrUrl) ? pathnameOrUrl : [pathnameOrUrl]).filter(Boolean);
    if (!items.length) return;
    // del() cần URL đầy đủ; tra từ pathname khi cần.
    const urls: string[] = [];
    for (const item of items) {
      if (/^https?:\/\//.test(item)) urls.push(item);
      else {
        const found = await list({ prefix: item, limit: 1 });
        const hit = found.blobs.find((b) => b.pathname === item);
        if (hit) urls.push(hit.url);
      }
    }
    if (urls.length) await del(urls);
  }

  /**
   * Chuẩn hóa giá trị ảnh trước khi lưu DB:
   *  - 'data:image/...;base64,...' -> upload lên Blob, trả về '/api/files/<folder>/<sha256>.<ext>'
   *    (tên theo hash nội dung: cùng ảnh không bị lưu trùng, import lại không sinh file thừa)
   *  - '/api/files/...' hoặc '' -> giữ nguyên
   *  - giá trị khác -> giữ nguyên (tương thích dữ liệu cũ)
   * Lưu ý: KHÔNG xóa ảnh cũ khi sửa/xóa bản ghi – một ảnh có thể được nhiều đơn (đơn tách) dùng chung.
   */
  async persistImage(value: unknown, folder: BlobFolder): Promise<string> {
    if (typeof value !== 'string' || !value) return '';
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
    if (!m) return value;
    const mime = (m[1] || 'application/octet-stream').toLowerCase();
    const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
    const ext = EXT_BY_MIME[mime] || 'bin';
    const hash = createHash('sha256').update(buf).digest('hex').slice(0, 40);
    const saved = await this.put(`${folder}/${hash}.${ext}`, buf, mime, { random: false });
    return saved.appUrl;
  }
}
