/**
 * File này: xử lý Bảo trì – bảo dưỡng: kiểm quyền, xem/tạo/sửa/xóa phiếu, xuất Excel (kèm ảnh) theo tháng/ngày.
 * Dùng ở: maintenance.controller.ts (trang Bảo trì) và backup.controller.ts (cron xuất Excel hằng ngày lên Blob).
 */
import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, lt } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { displayName } from '../../auth/auth.types';
import type { DbUser } from '../../auth/auth.types';
import { BlobService } from '../../blob/blob.service';
import { ApiError } from '../../common/api-error';
import { vnStartOfDay } from '../../common/time';
import { DbService, schema } from '../../db/db.service';

// Bảng phiếu bảo trì và bảng audit (Drizzle); kiểu 1 dòng phiếu bảo trì.
const { maintenanceRecords, auditLogs } = schema;
type MaintenanceRow = typeof maintenanceRecords.$inferSelect;

/** Dòng bảo trì theo đúng dạng `SELECT * FROM maintenance_records` của server cũ (snake_case). */
export interface LegacyMaintenanceRecord {
  id: number;
  created_at: Date;
  // Thiết bị, mô tả hư hỏng, ảnh hư hỏng.
  equipment: string;
  fault_description: string;
  fault_image: string;
  // Nội dung sửa, trạng thái sau sửa, ảnh sau sửa.
  repair_content: string;
  after_status: string;
  after_image: string;
  // Tên người nhập.
  created_by: string;
  updated_at: Date | string;
}

/** Đổi dòng Drizzle (camelCase) sang dạng cũ (snake_case) mà trang web đang dùng. */
export function toLegacyMaintenance(r: MaintenanceRow): LegacyMaintenanceRecord {
  return {
    id: r.id,
    created_at: r.createdAt,
    equipment: r.equipment,
    fault_description: r.faultDescription,
    fault_image: r.faultImageUrl,
    repair_content: r.repairContent,
    after_status: r.afterStatus,
    after_image: r.afterImageUrl,
    created_by: r.createdBy,
    updated_at: r.updatedAt ?? '', // cũ: '' khi chưa sửa
  };
}

// 1 ngày và độ lệch giờ VN (UTC+7), tính bằng mili giây.
const DAY_MS = 24 * 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Thư mục gốc trên Blob cho file Excel bảo trì hằng ngày (có thể đổi khi test bằng BAOTRI_EXPORT_PREFIX). */
export function baotriExportRoot(): string {
  return (process.env.BAOTRI_EXPORT_PREFIX || 'baotri-exports').replace(/\/+$/, '');
}

// Ảnh đã tải để chèn Excel; hoặc lý do không chèn được ('unsupported' sai định dạng, 'missing' không thấy, null không có).
type ExcelImage = { buffer: Buffer; extension: 'png' | 'jpeg' | 'gif' };
type ImageLoad = ExcelImage | 'unsupported' | 'missing' | null;

/** Nhận dạng ảnh PNG/JPEG/GIF qua vài byte đầu file; loại khác → null. */
function sniffImage(buf: Buffer): ExcelImage['extension'] | null {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif';
  return null;
}

/** Chạy fn trên từng phần tử với số luồng song song giới hạn. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  // Kết quả giữ đúng thứ tự đầu vào.
  const out: R[] = new Array(items.length);
  let next = 0;
  // Tạo `limit` "công nhân", mỗi người lần lượt lấy phần tử tiếp theo để xử lý.
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  // Chờ mọi công nhân xong.
  await Promise.all(workers);
  return out;
}

// @Injectable: cho phép NestJS tự tạo và đưa service này vào controller.
@Injectable()
export class MaintenanceService {
  constructor(private readonly db: DbService, private readonly blob: BlobService) {}

  /** = requireMaintenanceAccess cũ. Cho qua: tài khoản đang hoạt động là Super/admin hoặc có quyền 'baotri'. */
  requireAccess(u: DbUser) {
    const ok = !!u && u.isActive && (u.isSuper || u.role === 'admin' || (u.pagePermissions ?? []).includes('baotri'));
    if (!ok) throw new ApiError(403, 'Bạn chưa được cấp quyền truy cập Bảo trì - Bảo dưỡng.');
  }

  /** Danh sách 1000 phiếu mới nhất + cờ isSuper (để trang hiện nút sửa/xóa). */
  async list(user: DbUser) {
    this.requireAccess(user);
    const rows = await this.db.orm
      .select()
      .from(maintenanceRecords)
      .orderBy(desc(maintenanceRecords.createdAt), desc(maintenanceRecords.id))
      .limit(1000);
    return { records: rows.map(toLegacyMaintenance), isSuper: Boolean(user.isSuper) };
  }

  /** Tạo phiếu mới: bắt buộc thiết bị + hư hỏng; ảnh lưu lên Blob. Trả về id phiếu. */
  async create(user: DbUser, b: any) {
    this.requireAccess(user);
    b = b || {};
    // Kiểm tra trường bắt buộc.
    if (!String(b.equipment || '').trim() || !String(b.faultDescription || '').trim()) {
      throw new ApiError(400, 'Vui lòng nhập thiết bị và nội dung hư hỏng.');
    }
    // Chèn phiếu (ảnh được upload trước), lấy lại id vừa tạo.
    const [row] = await this.db.orm
      .insert(maintenanceRecords)
      .values({
        equipment: String(b.equipment).trim(),
        faultDescription: String(b.faultDescription).trim(),
        faultImageUrl: await this.blob.persistImage(String(b.faultImage || ''), 'maintenance'),
        repairContent: String(b.repairContent || ''),
        afterStatus: String(b.afterStatus || ''),
        afterImageUrl: await this.blob.persistImage(String(b.afterImage || ''), 'maintenance'),
        createdBy: displayName(user),
        createdById: user.id,
      })
      .returning({ id: maintenanceRecords.id });
    return { ok: true, id: row.id };
  }

  /** Đổi id dạng chữ sang số nguyên dương hợp lệ (vừa cột integer); sai → null. */
  private parseId(id: string): number | null {
    const n = Number(id);
    return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null;
  }

  /** Sửa phiếu đã lưu (chỉ Super Admin); trường không gửi giữ nguyên; ghi audit EDIT_MAINTENANCE. */
  async update(user: DbUser, idParam: string, b: any) {
    this.requireAccess(user);
    if (!user.isSuper) throw new ApiError(403, 'Chỉ Super Admin mới được sửa dữ liệu bảo trì đã lưu.');
    b = b || {};
    const id = this.parseId(idParam);
    const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
    // Upload ảnh (nếu là data-URL) trước khi mở transaction để không giữ khóa lâu.
    const faultImage = has('faultImage') ? await this.blob.persistImage(String(b.faultImage ?? ''), 'maintenance') : undefined;
    const afterImage = has('afterImage') ? await this.blob.persistImage(String(b.afterImage ?? ''), 'maintenance') : undefined;
    await this.db.tx(async (t) => {
      // Khóa phiếu cần sửa (FOR UPDATE); không có → 404.
      const [old] = id
        ? await t.orm.select().from(maintenanceRecords).where(eq(maintenanceRecords.id, id)).for('update')
        : [];
      if (!old) throw new ApiError(404, 'Không tìm thấy bản ghi bảo trì.');
      // Có gửi → giá trị mới; không gửi → giữ cũ.
      const val = (k: string, oldValue: string) => (has(k) ? String(b[k] ?? '') : oldValue);
      await t.orm
        .update(maintenanceRecords)
        .set({
          equipment: val('equipment', old.equipment),
          faultDescription: val('faultDescription', old.faultDescription),
          faultImageUrl: faultImage ?? old.faultImageUrl,
          repairContent: val('repairContent', old.repairContent),
          afterStatus: val('afterStatus', old.afterStatus),
          afterImageUrl: afterImage ?? old.afterImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(maintenanceRecords.id, old.id));
      // Ghi nhật ký với ảnh đã chuyển thành đường dẫn (không lưu data-URL khổng lồ vào audit).
      const after = { ...b };
      if (faultImage !== undefined) after.faultImage = faultImage;
      if (afterImage !== undefined) after.afterImage = afterImage;
      await t.orm.insert(auditLogs).values({
        actionType: 'EDIT_MAINTENANCE',
        targetId: String(old.id),
        orderNumber: '',
        details: { before: toLegacyMaintenance(old), after },
        actor: displayName(user),
        actorId: user.id,
      });
    });
    return { ok: true };
  }

  /** Xóa phiếu (chỉ Super Admin); lưu bản đã xóa vào audit DELETE_MAINTENANCE. */
  async remove(user: DbUser, idParam: string) {
    this.requireAccess(user);
    if (!user.isSuper) throw new ApiError(403, 'Chỉ Super Admin mới được xóa dữ liệu bảo trì đã lưu.');
    const id = this.parseId(idParam);
    await this.db.tx(async (t) => {
      // Khóa phiếu; không có → 404.
      const [old] = id
        ? await t.orm.select().from(maintenanceRecords).where(eq(maintenanceRecords.id, id)).for('update')
        : [];
      if (!old) throw new ApiError(404, 'Không tìm thấy bản ghi bảo trì.');
      // Xóa rồi ghi audit.
      await t.orm.delete(maintenanceRecords).where(eq(maintenanceRecords.id, old.id));
      await t.orm.insert(auditLogs).values({
        actionType: 'DELETE_MAINTENANCE',
        targetId: String(old.id),
        orderNumber: '',
        details: { deleted: toLegacyMaintenance(old) },
        actor: displayName(user),
        actorId: user.id,
      });
    });
    return { ok: true };
  }

  /** Bản ghi trong khoảng [from, to) theo created_at, cũ → mới. */
  private rowsBetween(from: Date, to: Date) {
    return this.db.orm
      .select()
      .from(maintenanceRecords)
      .where(and(gte(maintenanceRecords.createdAt, from), lt(maintenanceRecords.createdAt, to)))
      .orderBy(asc(maintenanceRecords.createdAt), asc(maintenanceRecords.id));
  }

  /** Excel theo tháng (YYYY-MM, giờ VN). */
  async exportMonth(user: DbUser, monthParam: unknown): Promise<{ filename: string; buffer: Buffer }> {
    this.requireAccess(user);
    // Tháng phải đúng dạng YYYY-MM.
    const month = String(monthParam || '');
    if (!/^\d{4}-\d{2}$/.test(month)) throw new ApiError(400, 'Tháng xuất không hợp lệ (YYYY-MM).');
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    try {
      // Ngày đầu tháng sau (tháng 12 → sang năm mới), lấy phiếu trong tháng rồi dựng Excel.
      const nextKey = m >= 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const rows = await this.rowsBetween(vnStartOfDay(`${month}-01`), vnStartOfDay(nextKey));
      const buffer = await this.buildWorkbook(rows, `BẢO TRÌ - BẢO DƯỠNG THÁNG ${month}`);
      return { filename: `bao_tri_${month}.xlsx`, buffer };
    } catch (e) {
      console.error('[BẢO TRÌ] Lỗi tạo Excel:', e);
      throw new ApiError(500, 'Không thể tạo file Excel. Vui lòng kiểm tra cài đặt exceljs.');
    }
  }

  /**
   * Xuất Excel bảo trì của một ngày (giờ VN) lên Blob:
   * `baotri-exports/YYYY/MM/bao_tri_YYYY-MM-DD.xlsx` (ghi đè nếu đã có). Gọi từ cron hằng ngày.
   */
  async exportDay(dateKey: string): Promise<{ pathname: string; count: number }> {
    // Lấy phiếu trong ngày và dựng Excel.
    const start = vnStartOfDay(dateKey);
    const rows = await this.rowsBetween(start, new Date(start.getTime() + DAY_MS));
    const buffer = await this.buildWorkbook(rows, `BẢO TRÌ - BẢO DƯỠNG NGÀY ${dateKey}`);
    // Lưu lên Blob với tên cố định (random: false → ghi đè file cũ cùng tên).
    const pathname = `${baotriExportRoot()}/${dateKey.slice(0, 4)}/${dateKey.slice(5, 7)}/bao_tri_${dateKey}.xlsx`;
    const saved = await this.blob.put(
      pathname,
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      { random: false },
    );
    return { pathname: saved.pathname, count: rows.length };
  }

  /** Ảnh cho Excel: '/api/files/…' (Blob private) hoặc data-URL cũ. ExcelJS chỉ hỗ trợ PNG/JPEG/GIF. */
  private async loadImage(value: string): Promise<ImageLoad> {
    if (!value) return null;
    // Ảnh nằm trên Blob → đọc file; lỗi/rỗng → 'missing'.
    const pathname = BlobService.pathnameFromAppUrl(value);
    if (pathname) {
      let buf: Buffer | null = null;
      try {
        buf = await this.blob.readBuffer(pathname);
      } catch (e) {
        console.error('[BẢO TRÌ] Không đọc được ảnh', pathname, (e as Error)?.message);
      }
      if (!buf || !buf.length) return 'missing';
      const ext = sniffImage(buf);
      return ext ? { buffer: buf, extension: ext } : 'unsupported';
    }
    // Ảnh cũ dạng data-URL base64 → giải mã.
    const match = /^data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(value);
    if (!match) return 'unsupported';
    const buf = Buffer.from(match[2], 'base64');
    const ext = sniffImage(buf);
    return ext ? { buffer: buf, extension: ext } : 'unsupported';
  }

  /** Dựng file Excel bảo trì: tiêu đề, bảng phiếu, chèn ảnh hư hỏng / sau sửa vào ô. */
  async buildWorkbook(rows: MaintenanceRow[], title: string): Promise<Buffer> {
    // Tải trước ảnh (song song có giới hạn) để không chờ tuần tự từng ảnh.
    const urls = [...new Set(rows.flatMap((r) => [r.faultImageUrl, r.afterImageUrl]).filter(Boolean))];
    const loaded = await mapLimit(urls, 6, (u) => this.loadImage(u));
    const images = new Map<string, ImageLoad>(urls.map((u, i) => [u, loaded[i]]));

    // Tạo sổ Excel, sheet "Bao tri" cố định 3 dòng đầu.
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SUPER WHITE';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Bao tri', { views: [{ state: 'frozen', ySplit: 3 }] });
    // Dòng 1: tiêu đề lớn, gộp ô A1:I1.
    sheet.mergeCells('A1:I1');
    sheet.getCell('A1').value = title;
    sheet.getCell('A1').font = { bold: true, size: 18 };
    sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 32;
    // Dòng 3: tiêu đề cột (chữ trắng, nền xanh, có viền).
    const headers = ['Mã', 'Ngày giờ', 'Thiết bị', 'Hư hỏng', 'Ảnh hư hỏng', 'Nội dung sửa chữa', 'Trạng thái sau sửa', 'Ảnh sau sửa', 'Người nhập'];
    const header = sheet.getRow(3);
    header.values = headers;
    header.height = 28;
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF203F8E' } };
    header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    header.eachCell((cell) => {
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    // Độ rộng từng cột.
    sheet.columns = [
      { key: 'id', width: 8 },
      { key: 'created_at', width: 23 },
      { key: 'equipment', width: 26 },
      { key: 'fault_description', width: 38 },
      { key: 'fault_image', width: 22 },
      { key: 'repair_content', width: 38 },
      { key: 'after_status', width: 32 },
      { key: 'after_image', width: 22 },
      { key: 'created_by', width: 20 },
    ];
    // Chèn ảnh vào ô (mỗi ảnh chỉ nạp vào sổ 1 lần); không chèn được thì ghi lý do bằng chữ.
    const imageIds = new Map<string, number>();
    const placeImage = (value: string, col: number, rowNumber: number) => {
      const img = value ? images.get(value) : null;
      if (img && typeof img === 'object') {
        let imageId = imageIds.get(value);
        if (imageId === undefined) {
          imageId = workbook.addImage({ buffer: img.buffer as any, extension: img.extension });
          imageIds.set(value, imageId);
        }
        sheet.addImage(imageId, { tl: { col, row: rowNumber - 1 }, br: { col: col + 1, row: rowNumber }, editAs: 'oneCell' } as any);
      } else {
        sheet.getRow(rowNumber).getCell(col + 1).value = !value
          ? 'Không có ảnh'
          : img === 'missing'
            ? 'Không tìm thấy ảnh'
            : 'Ảnh không hỗ trợ định dạng Excel';
      }
    };
    // Mỗi phiếu 1 dòng, bắt đầu từ dòng 4.
    rows.forEach((r, index) => {
      const rowNumber = index + 4;
      const row = sheet.getRow(rowNumber);
      // Excel không có múi giờ: ghi giờ Việt Nam (UTC+7) như server cũ.
      const excelLocalDate = new Date(r.createdAt.getTime() + VN_OFFSET_MS);
      row.values = [r.id, excelLocalDate, r.equipment, r.faultDescription, '', r.repairContent, r.afterStatus, '', r.createdBy];
      // Định dạng ngày giờ, chiều cao đủ chứa ảnh, viền nhạt.
      row.getCell(2).numFmt = 'dd/mm/yyyy hh:mm:ss';
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      row.height = 76;
      row.alignment = { vertical: 'middle', wrapText: true };
      row.eachCell((cell) => {
        const side = { style: 'thin' as const, color: { argb: 'FFD5DEEA' } };
        cell.border = { top: side, left: side, bottom: side, right: side };
      });
      // Ảnh hư hỏng ở cột E, ảnh sau sửa ở cột H.
      placeImage(r.faultImageUrl, 4, rowNumber);
      placeImage(r.afterImageUrl, 7, rowNumber);
    });
    // Bật bộ lọc rồi xuất file.
    sheet.autoFilter = { from: 'A3', to: 'I3' };
    const out = await workbook.xlsx.writeBuffer();
    return Buffer.from(out as ArrayBuffer);
  }
}
