import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { ApiError } from '../../common/api-error';
import { DbUser, displayName } from '../../auth/auth.types';
import { BlobService } from '../../blob/blob.service';
import { DbService, Queryable } from '../../db/db.service';

export const DOC_PREFIX = 'documents/';
export const DOC_MAX_BYTES = 50 * 1024 * 1024;
const EXCEL_EXTS = ['.xlsx', '.xlsm', '.xls', '.xlsb'];
const MIME_BY_EXT: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
  '.xls': 'application/vnd.ms-excel',
  '.xlsb': 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

const isSuper = (u: DbUser) => !!u.isSuper;
const extOf = (name: string) => path.extname(String(name || '')).toLowerCase();
const baseName = (name: string) => path.basename(String(name || '').replace(/\\/g, '/'));

export interface DocRow {
  id: string;
  original_name: string;
  blob_pathname: string;
  mime_type: string;
  size_bytes: number;
  owner_id: number | null;
  owner_name: string;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

interface UploadedBlob {
  pathname: string;
  originalName: string;
  size: number;
  mimeType: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: DbService,
    private readonly blob: BlobService,
  ) {}

  /** = currentUser() cũ: tài khoản phải còn hoạt động. */
  assertUser(u: DbUser | undefined): DbUser {
    if (!u || !u.isActive) throw new ApiError(401, 'Tài khoản không hợp lệ.');
    return u;
  }

  private async getDoc(q: Queryable, id: string, forUpdate = false): Promise<DocRow | undefined> {
    if (!isUuid(id)) return undefined;
    return q.get<DocRow>(`SELECT * FROM documents WHERE id = ? AND is_deleted = FALSE${forUpdate ? ' FOR UPDATE' : ''}`, [id]);
  }

  /** = canAccess() cũ: super → edit; chủ sở hữu → owner; người được chia quyền → view|edit; còn lại → null. */
  async canAccess(id: string, u: DbUser): Promise<{ access: string; file: DocRow } | null> {
    if (!isUuid(id)) return null;
    if (isSuper(u)) {
      const file = await this.getDoc(this.db, id);
      return file ? { access: 'edit', file } : null;
    }
    const row = await this.db.get<DocRow & { access: string }>(
      `SELECT d.*, CASE WHEN d.owner_id = ? THEN 'owner' ELSE p.permission END AS access
         FROM documents d LEFT JOIN document_permissions p ON p.document_id = d.id AND p.user_id = ?
        WHERE d.id = ? AND d.is_deleted = FALSE AND (d.owner_id = ? OR p.user_id = ?)`,
      [u.id, u.id, id, u.id, u.id],
    );
    return row ? { access: row.access, file: row } : null;
  }

  /** Super Admin không ghi lịch sử trong phân hệ này (như cũ). */
  async addLog(id: string, u: DbUser, action: string, q: Queryable = this.db) {
    if (isSuper(u)) return;
    await q.run('INSERT INTO document_activity_logs (document_id, user_id, user_name, action) VALUES (?, ?, ?, ?)', [
      id,
      u.id,
      displayName(u),
      action,
    ]);
  }

  // ------------------------------------------------------------------------------------------
  async list(u: DbUser) {
    const rows = await this.db.all<Record<string, any>>(
      `SELECT d.id, d.original_name, d.owner_id AS owner_user_id, d.owner_name, d.size_bytes, d.created_at, d.updated_at,
              CASE WHEN d.owner_id = ? THEN 'owner' WHEN ? THEN 'edit' ELSE p.permission END AS my_permission
         FROM documents d LEFT JOIN document_permissions p ON p.document_id = d.id AND p.user_id = ?
        WHERE d.is_deleted = FALSE AND (? OR d.owner_id = ? OR p.user_id = ?)
        ORDER BY d.updated_at DESC`,
      [u.id, isSuper(u), u.id, isSuper(u), u.id, u.id],
    );
    const files = rows.map((f) => ({ ...f, version: new Date(f.updated_at).getTime() }));
    return { files, isSuper: isSuper(u), currentUserId: u.id };
  }

  /** Người dùng có thể được chia quyền: đang hoạt động, không phải Super Admin. */
  async users() {
    const rows = await this.db.all<{ id: number; username: string; full_name: string; position: string }>(
      'SELECT id, username, full_name, position FROM users WHERE is_active = TRUE AND is_super = FALSE ORDER BY full_name, username',
    );
    return { users: rows.map((x) => ({ id: x.id, username: x.username, fullName: x.full_name || x.username, position: x.position || '' })) };
  }

  // ------------------------------------------------------------------------------------------
  // File trên Blob (frontend đã upload lên documents/)
  // ------------------------------------------------------------------------------------------
  private async findBlob(pathname: string) {
    const found = await this.blob.list(pathname);
    return found.find((b) => b.pathname === pathname) || null;
  }

  private async isReferenced(pathname: string) {
    return !!(await this.db.get('SELECT 1 FROM documents WHERE blob_pathname = ?', [pathname]));
  }

  /** Xóa blob vừa upload nhưng bị từ chối (tương đương fs.unlink(req.file.path) cũ) – chỉ khi chưa tài liệu nào dùng. */
  async discardUpload(pathname: string) {
    try {
      if (!(await this.isReferenced(pathname))) await this.blob.delete(pathname);
    } catch (e: any) {
      console.error('[TAI LIEU] Không xóa được file tạm trên Blob:', e?.message || e);
    }
  }

  /**
   * Kiểm tra file đã upload: pathname thuộc documents/, đuôi Excel, tồn tại trên Blob, ≤ 50 MB.
   * Lỗi định dạng/kích thước → xóa blob (như multer cũ không giữ lại file bị từ chối).
   */
  private async validateUpload(body: any, msgs: { missing: string; badExt: string }): Promise<UploadedBlob> {
    const pathname = typeof body?.pathname === 'string' ? body.pathname.trim() : '';
    if (!pathname) throw new ApiError(400, msgs.missing);
    if (!pathname.startsWith(DOC_PREFIX) || pathname.includes('..') || pathname.length > 1024 || pathname.endsWith('/')) {
      throw new ApiError(400, 'Đường dẫn file không hợp lệ.');
    }
    if (await this.isReferenced(pathname)) throw new ApiError(400, 'File này đã được dùng cho một tài liệu khác.');
    const originalName = baseName(typeof body?.originalName === 'string' && body.originalName.trim() ? body.originalName.trim() : pathname).slice(0, 255);
    const found = await this.findBlob(pathname);
    if (!found) throw new ApiError(400, 'Không tìm thấy file đã tải lên. Vui lòng tải lại.');
    const ext = extOf(originalName);
    if (!EXCEL_EXTS.includes(ext) || !EXCEL_EXTS.includes(extOf(pathname))) {
      await this.discardUpload(pathname);
      throw new ApiError(400, msgs.badExt);
    }
    if (found.size > DOC_MAX_BYTES) {
      await this.discardUpload(pathname);
      throw new ApiError(400, 'File vượt quá 50 MB.');
    }
    const ct = typeof body?.contentType === 'string' ? body.contentType.trim() : '';
    const mimeType = ct && ct !== 'application/octet-stream' && ct.length < 200 ? ct : MIME_BY_EXT[ext] || 'application/octet-stream';
    return { pathname, originalName, size: found.size, mimeType };
  }

  async upload(u: DbUser, body: any) {
    const up = await this.validateUpload(body, {
      missing: 'Bạn chưa chọn file Excel.',
      badExt: 'Chỉ chấp nhận file Excel .xlsx, .xlsm, .xls hoặc .xlsb.',
    });
    const id = randomUUID();
    try {
      const file = await this.db.tx(async (t) => {
        const row = await t.get<DocRow>(
          `INSERT INTO documents (id, original_name, blob_pathname, mime_type, size_bytes, owner_id, owner_name)
           VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
          [id, up.originalName, up.pathname, up.mimeType, up.size, u.id, displayName(u)],
        );
        await this.addLog(id, u, 'Tải tài liệu lên', t);
        return row!;
      });
      return {
        ok: true,
        id,
        message: 'Tải tài liệu lên thành công.',
        file: {
          id: file.id,
          original_name: file.original_name,
          owner_user_id: file.owner_id,
          owner_name: file.owner_name,
          size_bytes: file.size_bytes,
          created_at: file.created_at,
          updated_at: file.updated_at,
          my_permission: 'owner',
          version: new Date(file.updated_at).getTime(),
        },
      };
    } catch (e) {
      console.error(e);
      await this.discardUpload(up.pathname);
      throw new ApiError(500, 'Không lưu được thông tin tài liệu.');
    }
  }

  /** Cập nhật phiên bản: chủ sở hữu, người có quyền edit hoặc Super Admin; tôn trọng khóa chỉnh sửa. */
  async update(id: string, u: DbUser, body: any) {
    const up = await this.validateUpload(body, {
      missing: 'Bạn chưa chọn file Excel để cập nhật.',
      badExt: 'File không đúng định dạng Excel (.xlsx, .xlsm, .xls, .xlsb).',
    });
    let oldPathname = '';
    let version = 0;
    try {
      await this.db.tx(async (t) => {
        const f = isUuid(id)
          ? await t.get<DocRow & { access: string | null }>(
              `SELECT d.*, CASE WHEN d.owner_id = ? THEN 'owner' ELSE p.permission END AS access
                 FROM documents d LEFT JOIN document_permissions p ON p.document_id = d.id AND p.user_id = ?
                WHERE d.id = ? AND d.is_deleted = FALSE FOR UPDATE OF d`,
              [u.id, u.id, id],
            )
          : undefined;
        if (!f) throw new ApiError(404, 'Tài liệu không tồn tại hoặc bạn không có quyền truy cập.');
        if (!isSuper(u) && f.owner_id !== u.id && f.access !== 'edit') {
          throw new ApiError(403, 'Bạn chỉ có quyền xem, không được cập nhật tài liệu này.');
        }
        const currentVersion = new Date(f.updated_at).getTime();
        const expected = body?.expectedVersion;
        if (expected !== undefined && expected !== null && expected !== '' && String(expected) !== String(currentVersion)) {
          throw new ApiError(
            409,
            'Tài liệu trên máy chủ đã được cập nhật bởi người khác. Hãy tải bản mới nhất về trước khi cập nhật.',
          );
        }
        // Khóa chỉnh sửa còn hiệu lực
        const lock = await t.get<{ user_id: number; user_name: string; lock_token: string }>(
          'SELECT user_id, user_name, lock_token FROM document_locks WHERE document_id = ? AND expires_at > NOW()',
          [id],
        );
        const lockToken = body?.lockToken;
        if (lockToken !== undefined && lockToken !== null && lockToken !== '') {
          if (!lock || lock.user_id !== u.id || String(lock.lock_token) !== String(lockToken)) {
            throw new ApiError(409, 'Quyền chỉnh sửa đã hết hạn hoặc không còn thuộc về bạn.');
          }
        } else if (lock && lock.user_id !== u.id) {
          throw new ApiError(409, `${lock.user_name || 'Người khác'} đang chỉnh sửa tài liệu này. Bạn chỉ có thể xem.`);
        }
        oldPathname = f.blob_pathname;
        const r = await t.get<{ updated_at: Date }>(
          `UPDATE documents SET original_name = ?, blob_pathname = ?, mime_type = ?, size_bytes = ?, updated_at = NOW()
            WHERE id = ? RETURNING updated_at`,
          [up.originalName, up.pathname, up.mimeType, up.size, id],
        );
        version = new Date(r!.updated_at).getTime();
      });
    } catch (e) {
      await this.discardUpload(up.pathname);
      if (e instanceof ApiError) throw e;
      console.error(e);
      throw new ApiError(500, 'Không cập nhật được tài liệu.');
    }
    await this.addLog(id, u, 'Cập nhật tài liệu').catch((err) => console.error('[TAI LIEU] Không ghi được lịch sử cập nhật:', err.message));
    if (oldPathname && oldPathname !== up.pathname) {
      await this.blob.delete(oldPathname).catch((err) => console.error('[TAI LIEU] Không xóa được bản cũ trên Blob:', err?.message || err));
    }
    return { ok: true, message: 'Cập nhật tài liệu thành công.', version };
  }

  async openForDownload(id: string, u: DbUser) {
    const access = await this.canAccess(id, u);
    if (!access) throw new ApiError(404, 'Tài liệu không tồn tại hoặc bạn không có quyền xem.');
    const f = access.file;
    const r = await this.blob.get(f.blob_pathname).catch(() => null);
    if (!r || !r.stream) throw new ApiError(404, 'Không tìm thấy file trên máy chủ.');
    await this.addLog(f.id, u, 'Xem/tải tài liệu');
    return { file: f, blob: r };
  }

  // ------------------------------------------------------------------------------------------
  // Phân quyền
  // ------------------------------------------------------------------------------------------
  async getPermissions(id: string, u: DbUser) {
    const f = await this.getDoc(this.db, id);
    if (!f) throw new ApiError(404, 'Không tìm thấy tài liệu.');
    if (!isSuper(u) && f.owner_id !== u.id) throw new ApiError(403, 'Chỉ người tải lên mới được phân quyền.');
    const rows = await this.db.all(
      `SELECT p.user_id, p.permission, p.granted_at, COALESCE(us.username, '') AS username, COALESCE(us.full_name, '') AS full_name
         FROM document_permissions p LEFT JOIN users us ON us.id = p.user_id
        WHERE p.document_id = ? ORDER BY p.user_id`,
      [id],
    );
    return { permissions: rows };
  }

  async setPermissions(id: string, u: DbUser, body: any) {
    const list: any[] = Array.isArray(body?.permissions) ? body.permissions : [];
    try {
      await this.db.tx(async (t) => {
        const f = await this.getDoc(t, id, true);
        if (!f) throw new ApiError(404, 'Không tìm thấy tài liệu.');
        if (!isSuper(u) && f.owner_id !== u.id) throw new ApiError(403, 'Chỉ người tải lên mới được phân quyền.');
        await t.run('DELETE FROM document_permissions WHERE document_id = ?', [id]);
        const wanted = new Map<number, 'view' | 'edit'>();
        for (const p of list) {
          const uid = Number(p?.userId);
          if (!Number.isInteger(uid) || uid <= 0 || uid === Number(f.owner_id)) continue;
          wanted.set(uid, p?.permission === 'edit' ? 'edit' : 'view');
        }
        if (!wanted.size) return;
        const valid = await t.all<{ id: number }>(
          'SELECT id FROM users WHERE id = ANY(?::int[]) AND is_active = TRUE AND is_super = FALSE',
          [[...wanted.keys()]],
        );
        for (const { id: uid } of valid) {
          await t.run(
            `INSERT INTO document_permissions (document_id, user_id, permission, granted_by) VALUES (?, ?, ?, ?)
             ON CONFLICT (document_id, user_id) DO UPDATE SET permission = EXCLUDED.permission, granted_by = EXCLUDED.granted_by, granted_at = NOW()`,
            [id, uid, wanted.get(uid), u.id],
          );
        }
      });
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.error(e);
      throw new ApiError(500, 'Không cập nhật được phân quyền.');
    }
    await this.addLog(id, u, 'Thay đổi phân quyền').catch((err) => console.error('[TAI LIEU]', err.message));
    return { ok: true, message: 'Đã cập nhật phân quyền.' };
  }

  // ------------------------------------------------------------------------------------------
  // Khóa chỉnh sửa (3 phút, gia hạn bằng renew)
  // ------------------------------------------------------------------------------------------
  async lock(id: string, u: DbUser) {
    const access = await this.canAccess(id, u);
    if (!access) throw new ApiError(404, 'Bạn không có quyền truy cập tài liệu.');
    if (access.access === 'view') throw new ApiError(403, 'Bạn chỉ có quyền xem, không được chỉnh sửa.');
    try {
      const r = await this.db.get<{ lock_token: string; expires_at: Date }>(
        `INSERT INTO document_locks (document_id, user_id, user_name, lock_token, expires_at)
         VALUES (?, ?, ?, ?, NOW() + INTERVAL '3 minutes')
         ON CONFLICT (document_id) DO UPDATE SET user_id = EXCLUDED.user_id, user_name = EXCLUDED.user_name,
           lock_token = EXCLUDED.lock_token, acquired_at = NOW(), expires_at = EXCLUDED.expires_at
         WHERE document_locks.expires_at < NOW() OR document_locks.user_id = EXCLUDED.user_id
         RETURNING user_id, user_name, lock_token, expires_at`,
        [id, u.id, displayName(u), randomUUID()],
      );
      if (!r) {
        const current = await this.db.get<{ user_name: string }>('SELECT user_name, expires_at FROM document_locks WHERE document_id = ?', [id]);
        throw new ApiError(409, `${current?.user_name || 'Người khác'} đang chỉnh sửa tài liệu này. Bạn chỉ có thể xem.`);
      }
      await this.addLog(id, u, 'Bắt đầu chỉnh sửa');
      return { ok: true, token: r.lock_token, expiresAt: r.expires_at, message: 'Bạn đã nhận quyền chỉnh sửa.' };
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.error(e);
      throw new ApiError(500, 'Không thể nhận khóa chỉnh sửa.');
    }
  }

  async renewLock(id: string, u: DbUser, token: unknown) {
    const r =
      isUuid(id) && isUuid(token)
        ? await this.db.get<{ expires_at: Date }>(
            `UPDATE document_locks SET expires_at = NOW() + INTERVAL '3 minutes'
              WHERE document_id = ? AND user_id = ? AND lock_token = ? RETURNING expires_at`,
            [id, u.id, token],
          )
        : undefined;
    if (!r) throw new ApiError(409, 'Quyền chỉnh sửa đã hết hạn hoặc không còn thuộc về bạn.');
    return { ok: true, expiresAt: r.expires_at };
  }

  async unlock(id: string, u: DbUser) {
    if (!isUuid(id)) return { ok: true, released: false };
    try {
      const r = await this.db.run('DELETE FROM document_locks WHERE document_id = ? AND (user_id = ? OR ?) RETURNING document_id', [
        id,
        u.id,
        isSuper(u),
      ]);
      if (r.changes) await this.addLog(id, u, 'Kết thúc chỉnh sửa / mở khóa');
      return { ok: true, released: r.changes > 0 };
    } catch (e) {
      console.error(e);
      throw new ApiError(500, 'Không mở khóa được tài liệu.');
    }
  }

  // ------------------------------------------------------------------------------------------
  /** Xóa mềm (is_deleted) như cũ – file trên Blob được giữ lại (server cũ không xóa file). */
  async remove(id: string, u: DbUser) {
    const f = await this.getDoc(this.db, id);
    if (!f) throw new ApiError(404, 'Không tìm thấy tài liệu.');
    if (!isSuper(u) && f.owner_id !== u.id) throw new ApiError(403, 'Chỉ người tải lên mới được xóa tài liệu.');
    try {
      await this.db.tx(async (t) => {
        await this.addLog(id, u, 'Xóa tài liệu', t);
        await t.run('UPDATE documents SET is_deleted = TRUE, updated_at = NOW() WHERE id = ?', [id]);
        await t.run('DELETE FROM document_locks WHERE document_id = ?', [id]);
      });
      return { ok: true, message: 'Đã chuyển tài liệu vào trạng thái đã xóa.' };
    } catch (e) {
      console.error(e);
      throw new ApiError(500, 'Không xóa được tài liệu.');
    }
  }

  async history(id: string, u: DbUser) {
    const f = await this.getDoc(this.db, id);
    if (!f) throw new ApiError(404, 'Không tìm thấy tài liệu.');
    if (!isSuper(u) && f.owner_id !== u.id) throw new ApiError(403, 'Chỉ người tải lên mới được xem lịch sử.');
    const rows = await this.db.all(
      'SELECT user_name, action, created_at FROM document_activity_logs WHERE document_id = ? ORDER BY created_at DESC LIMIT 500',
      [id],
    );
    return { history: rows };
  }
}
