/**
 * File này: sao lưu toàn bộ DB Postgres ra file JSON nén (gzip) lên Vercel Blob; liệt kê, dọn bản cũ, kiểm đường dẫn tải.
 * Dùng ở: backup.controller.ts (Super Admin bấm sao lưu, cron hằng ngày) và module khác qua BackupService.
 */
import { Injectable } from '@nestjs/common';
import { createGzip } from 'zlib';
import { BlobService } from '../../blob/blob.service';
import { vnDateKey, vnLocaleString, vnTimeKey } from '../../common/time';
import { DbService, TxQueryable } from '../../db/db.service';

/** Thư mục gốc của bản sao lưu trên Blob (có thể đổi khi test bằng BACKUP_PREFIX, phải nằm dưới 'backups'). */
export function backupRoot(): string {
  return (process.env.BACKUP_PREFIX || 'backups').replace(/\/+$/, '');
}

/** Tên thư mục sao lưu: `<YYYY-MM-DD>_<kind>_<HHmmss>` (giờ VN). */
const FOLDER_RE = /^(\d{4}-\d{2}-\d{2})_([a-z]+)_(\d{6})$/;
/** Số bản sao lưu 'daily' được giữ lại. */
export const DAILY_KEEP = 30;
/** Khóa advisory chống chạy 2 tiến trình sao lưu cùng lúc (thay cho biến backupRunning trong RAM). */
const BACKUP_LOCK_KEY = 720261101;
// Số dòng đọc mỗi lô; số file upload cùng lúc.
const FETCH_SIZE = 2000;
const UPLOAD_CONCURRENCY = 8;

/** Một bản sao lưu (thư mục trên Blob): tên, thời gian, loại, tổng dung lượng, danh sách file. */
export interface BackupFolder {
  name: string;
  createdAt: string;
  kind: string;
  path: string;
  size: number;
  files: Array<{ pathname: string; size: number }>;
  urls: string[];
}

/** Kết quả xuất 1 bảng: tên bảng, số dòng, cấu trúc cột, tên file và nội dung nén. */
interface TableDump {
  table: string;
  rows: number;
  columns: Array<{ name: string; type: string; nullable: boolean }>;
  file: string;
  buffer: Buffer;
}

/** Bọc tên bảng trong dấu "…" để dùng an toàn trong SQL. */
const qIdent = (name: string) => '"' + name.replace(/"/g, '""') + '"';

@Injectable()
export class BackupService {
  constructor(private readonly db: DbService, private readonly blob: BlobService) {}

  /**
   * Sao lưu toàn bộ bảng schema public (trừ bảng drizzle) ra JSON gzip + manifest + README lên Blob
   * `backups/<YYYY-MM-DD>_<kind>_<HHmmss>/`. Đọc trong 1 transaction REPEATABLE READ để có ảnh chụp nhất quán.
   * Trả về null nếu đang có tiến trình sao lưu khác hoặc thất bại (như createFullBackup cũ).
   */
  async createFullBackup(kind: 'manual' | 'daily' = 'manual'): Promise<{ name: string; path: string; files: string[] } | null> {
    // Tên thư mục bản sao lưu + danh sách file đã upload (để dọn nếu lỗi).
    const now = new Date();
    const name = `${vnDateKey(now)}_${kind}_${vnTimeKey(now)}`;
    const prefix = `${backupRoot()}/${name}/`;
    const uploaded: string[] = [];
    try {
      return await this.db.tx(async (t) => {
        // Giao dịch chỉ đọc, thấy dữ liệu "đóng băng" tại một thời điểm.
        await t.run('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
        // Giành khóa; đang có tiến trình khác giữ → bỏ qua.
        const lock = await t.get<{ ok: boolean }>('SELECT pg_try_advisory_xact_lock(?::bigint) AS ok', [BACKUP_LOCK_KEY]);
        if (!lock?.ok) {
          console.log('[BACKUP] Đang có tiến trình sao lưu, bỏ qua lần gọi trùng.');
          return null;
        }
        // Lấy danh sách bảng dữ liệu (bỏ bảng nội bộ của drizzle).
        const tables = await t.all<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables
            WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name NOT ILIKE '%drizzle%'
            ORDER BY table_name`,
        );
        // Xuất lần lượt từng bảng.
        const dumps: TableDump[] = [];
        for (const { table_name } of tables) dumps.push(await this.dumpTable(t, table_name));

        // manifest.json: mô tả bản sao lưu và từng bảng.
        const manifest = {
          app: 'SUPER WHITE',
          format: 'superwhite-pg-json-v1',
          kind,
          name,
          createdAt: now.toISOString(),
          createdAtVN: vnLocaleString(now),
          tables: dumps.map((d) => ({ table: d.table, rows: d.rows, file: d.file, columns: d.columns })),
        };
        // README: hướng dẫn đọc bản sao lưu cho người xem.
        const readme = [
          'SUPER WHITE - BẢN SAO LƯU',
          `Loại: ${kind}`,
          `Thời gian: ${vnLocaleString(now)}`,
          'Cơ sở dữ liệu: Postgres, mỗi bảng (schema public) là một file <bảng>.json.gz',
          '  (mảng JSON các dòng, khóa = tên cột; thời gian dạng ISO UTC; cấu trúc cột trong manifest.json).',
          'Dữ liệu được đọc trong một giao dịch REPEATABLE READ nên nhất quán tại một thời điểm.',
          'Ảnh, tài liệu và file Excel bảo trì nằm trên Vercel Blob (orders/, maintenance/, avatars/, documents/, baotri-exports/);',
          '  cơ sở dữ liệu chỉ lưu đường dẫn /api/files/<pathname> tới các file đó.',
          `Chính sách: bản sao lưu tự động hằng ngày giữ ${DAILY_KEEP} bản gần nhất; bản tạo thủ công được giữ vĩnh viễn.`,
        ].join('\r\n');

        // Danh sách file cần upload: các bảng + manifest.
        const files: Array<{ path: string; body: Buffer | string; type: string }> = [
          ...dumps.map((d) => ({ path: prefix + d.file, body: d.buffer, type: 'application/gzip' })),
          { path: prefix + 'manifest.json', body: JSON.stringify(manifest, null, 2), type: 'application/json' },
          // README ghi cuối cùng: có README = bản sao lưu đầy đủ.
        ];
        // Upload song song (giới hạn) – mỗi lần put mất ~1 s, tuần tự sẽ vượt thời gian hàm serverless.
        let next = 0;
        await Promise.all(
          Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, async () => {
            while (next < files.length) {
              const f = files[next++];
              const saved = await this.blob.put(f.path, f.body, f.type, { random: false });
              uploaded.push(saved.url);
            }
          }),
        );
        // Upload README sau cùng.
        const saved = await this.blob.put(prefix + 'README_BACKUP.txt', readme, 'text/plain; charset=utf-8', { random: false });
        uploaded.push(saved.url);
        console.log(`[BACKUP] Sao lưu thành công: ${prefix}`);
        return { name, path: prefix, files: [...files.map((f) => f.path), prefix + 'README_BACKUP.txt'] };
      });
    } catch (error) {
      // Lỗi → xóa các file đã lỡ upload (bỏ qua lỗi khi xóa), trả null.
      console.error('[BACKUP] Sao lưu thất bại:', error);
      if (uploaded.length) await this.blob.delete(uploaded).catch(() => undefined);
      return null;
    }
  }

  /** Đọc một bảng bằng cursor (theo lô) và nén gzip dần để không giữ toàn bộ JSON trong RAM. */
  private async dumpTable(t: TxQueryable, table: string): Promise<TableDump> {
    // Lấy cấu trúc cột của bảng (tên, kiểu, cho phép rỗng).
    const columns = await t.all<{ name: string; type: string; nullable: boolean }>(
      `SELECT column_name AS name, data_type AS type, (is_nullable='YES') AS nullable
         FROM information_schema.columns WHERE table_schema='public' AND table_name=? ORDER BY ordinal_position`,
      [table],
    );
    // Bộ nén gzip: gom các mảnh đã nén vào `chunks`; `finished` báo khi nén xong.
    const gz = createGzip();
    const chunks: Buffer[] = [];
    gz.on('data', (c: Buffer) => chunks.push(c));
    const finished = new Promise<void>((resolve, reject) => {
      gz.on('end', resolve);
      gz.on('error', reject);
    });
    // Ghi chuỗi vào bộ nén; bộ đệm đầy thì chờ "drain" rồi mới ghi tiếp.
    const write = (s: string) =>
      gz.write(s) ? Promise.resolve() : new Promise<void>((resolve) => gz.once('drain', () => resolve()));

    // Ghi mảng JSON: mở "[" rồi đọc từng lô FETCH_SIZE dòng qua cursor.
    let count = 0;
    await write('[');
    await t.run(`DECLARE backup_cur NO SCROLL CURSOR FOR SELECT * FROM public.${qIdent(table)}`);
    for (;;) {
      const rows = await t.all(`FETCH ${FETCH_SIZE} FROM backup_cur`);
      // Mỗi dòng 1 object JSON, ngăn cách bằng dấu phẩy.
      for (const r of rows) await write((count++ ? ',\n' : '\n') + JSON.stringify(r));
      // Lô cuối (ít hơn FETCH_SIZE) → dừng.
      if (rows.length < FETCH_SIZE) break;
    }
    // Đóng cursor, đóng "]" và chờ nén xong.
    await t.run('CLOSE backup_cur');
    gz.end('\n]\n');
    await finished;
    return { table, rows: count, columns, file: `${table}.json.gz`, buffer: Buffer.concat(chunks) };
  }

  /** Danh sách bản sao lưu trên Blob, mới nhất trước. */
  async listBackups(): Promise<BackupFolder[]> {
    // Liệt kê mọi file dưới thư mục backups/.
    const root = backupRoot() + '/';
    const blobs = await this.blob.list(root);
    // Gom file theo thư mục (mỗi thư mục = 1 bản sao lưu).
    const folders = new Map<string, BackupFolder & { first: number }>();
    for (const b of blobs) {
      // Tách tên thư mục con; bỏ qua file nằm ngoài thư mục hoặc tên sai mẫu.
      const rest = b.pathname.slice(root.length);
      const slash = rest.indexOf('/');
      if (slash <= 0) continue;
      const name = rest.slice(0, slash);
      const m = FOLDER_RE.exec(name);
      if (!m) continue;
      // Thư mục mới → tạo mục; m[2] = loại (manual/daily).
      let f = folders.get(name);
      if (!f) {
        f = { name, kind: m[2], path: root + name + '/', createdAt: '', size: 0, files: [], urls: [], first: Infinity };
        folders.set(name, f);
      }
      // Cộng dung lượng, thêm file, ghi nhận thời điểm upload sớm nhất.
      f.size += b.size;
      f.files.push({ pathname: b.pathname, size: b.size });
      f.urls.push(b.url);
      const ts = new Date(b.uploadedAt).getTime();
      if (ts < f.first) f.first = ts;
    }
    // Đổi sang mảng: createdAt = lúc upload sớm nhất, file sắp theo tên, bản mới nhất lên đầu.
    return [...folders.values()]
      .map(({ first, ...f }) => ({ ...f, createdAt: Number.isFinite(first) ? new Date(first).toISOString() : '', files: f.files.sort((a, b) => a.pathname.localeCompare(b.pathname)) }))
      .sort((a, b) => b.name.localeCompare(a.name));
  }

  /** Giữ tối đa DAILY_KEEP bản 'daily' mới nhất; xóa các bản cũ hơn. Trả về tên các bản đã xóa. */
  async pruneDaily(keep = DAILY_KEEP): Promise<string[]> {
    // Danh sách đã sắp mới → cũ, nên phần sau vị trí `keep` là bản cũ cần xóa.
    const daily = (await this.listBackups()).filter((f) => f.kind === 'daily');
    const old = daily.slice(keep);
    for (const f of old) await this.blob.delete(f.urls);
    return old.map((f) => f.name);
  }

  /** pathname hợp lệ để tải: nằm dưới thư mục sao lưu, không chứa '..'. */
  isDownloadablePath(p: unknown): p is string {
    if (typeof p !== 'string' || !p) return false;
    // Chặn đường dẫn lén ra ngoài (.., \, bắt đầu/kết thúc bằng /).
    if (p.includes('..') || p.includes('\\') || p.startsWith('/') || p.endsWith('/')) return false;
    return p.startsWith('backups/') && p.startsWith(backupRoot() + '/');
  }
}
