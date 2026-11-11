/**
 * File này: API Đơn hàng /api/orders – danh sách, xuất Excel, tạo/sửa/xóa, chạy/tạm dừng/chạy thêm máy/chốt hoàn thành.
 * Dùng ở: trang Kế hoạch (ke-hoach) và trang Vận hành (van-hanh).
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import type { DbUser } from '../../auth/auth.types';
import { CurrentUser, RequireAdmin, RequirePage } from '../../auth/decorators';
import { BlobService } from '../../blob/blob.service';
import { ApiError } from '../../common/api-error';
import { vnDateKey } from '../../common/time';
import { DbService, Row } from '../../db/db.service';
import {
  actorName,
  addHistory,
  addOperationEvent,
  groupedOrderRows,
  lockOrder,
  lockOrderGroup,
  newOrderId,
  operationPermission,
  ORDER_SELECT,
  orderArchiveDate,
  orderFromRow,
  orderPerms,
} from './orders.helpers';

/** Body có gửi trường `k` không (kể cả giá trị rỗng). */
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
/** Chuỗi cho cột text NOT NULL (null/undefined → ''). */
const txt = (v: unknown) => (v === undefined || v === null ? '' : String(v));
/** Số cho cột double NOT NULL (giá trị không phải số → 0). */
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
// Giờ VN = UTC + 7 tiếng (tính bằng mili giây).
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Excel không có múi giờ (exceljs ghi theo UTC) → dịch sang giờ VN để ô hiển thị đúng giờ địa phương. */
const vnCell = (v: unknown): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() + VN_OFFSET_MS);
};
/** Ngày xuất ('YYYY-MM-DD' từ input date) giữ nguyên ngày. */
const dayCell = (v: unknown): Date | null => {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  return vnCell(s);
};

// Trường dữ liệu gốc của đơn – chỉ Super Admin được sửa.
const MASTER_DATA_FIELDS = [
  'orderNumber', 'itemCode', 'packagingCode', 'quantity', 'imageData',
  'whiteness', 'grainSize', 'bagWeight', 'coatingRate', 'stoneType',
  'impurity', 'pallet', 'extraBag', 'orderCommand', 'khoBu', 'exportDate', 'createdAt',
  'creatorName', 'runnerName', 'confirmerName',
];

// Mọi route trong lớp bắt đầu bằng /api/orders và cần đăng nhập.
@Controller('api/orders')
export class OrdersController {
  constructor(private readonly db: DbService, private readonly blob: BlobService) {}

  // ---------------------------------------------------------------------------------
  // Danh sách
  // ---------------------------------------------------------------------------------
  /** GET /api/orders – mọi đơn (mới nhất trước) + cờ quyền để trang bật/tắt nút. */
  @Get()
  async list(@CurrentUser() u: DbUser) {
    const perms = orderPerms(u);
    const isSuper = Boolean(u.isSuper);
    const rows = await this.db.all(`${ORDER_SELECT} ORDER BY o.created_at DESC`);
    // Super Admin luôn được; người thường cần đúng mã quyền.
    return {
      orders: rows.map(orderFromRow),
      permissions: perms,
      canCreate: isSuper || perms.includes('new'),
      canEdit: isSuper || perms.includes('edit'),
      canDelete: isSuper || perms.includes('delete'),
      canOperate: isSuper || perms.includes('vanhanh') || perms.includes('all'),
      canConfirm: isSuper || perms.includes('xacnhan') || perms.includes('all'),
      isSuper,
    };
  }

  // ---------------------------------------------------------------------------------
  // Xuất Excel kế hoạch
  // ---------------------------------------------------------------------------------
  /** GET /api/orders/export – tải file Excel kế hoạch theo bộ lọc (cần quyền trang Kế hoạch). */
  @Get('export')
  @RequirePage('kehoach')
  async export(@Query() query: Record<string, unknown>, @Res() res: Response) {
    // Tạo file; lỗi → ghi log và báo 500.
    let buffer: Buffer;
    try {
      buffer = await this.buildExport(query);
    } catch (e) {
      console.error('[KẾ HOẠCH] Lỗi xuất Excel:', e);
      throw new ApiError(500, 'Không thể xuất Excel kế hoạch.');
    }
    // Gửi file về trình duyệt để tải xuống.
    const name = `ke_hoach_${vnDateKey()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.send(buffer);
  }

  /** Dựng file Excel: sheet "Ke hoach" (đơn đã gộp) + sheet "Lich su don hang". */
  private async buildExport(query: Record<string, unknown>): Promise<Buffer> {
    // Đọc bộ lọc: từ khóa mã bao bì, tab (active/history), tháng.
    const q = String(query.search || '').trim().toLocaleLowerCase('vi');
    const view = String(query.view || 'active');
    const month = String(query.month || 'all');
    // Lấy và gộp đơn, rồi lọc theo bộ lọc.
    let rows = groupedOrderRows(await this.db.all(`${ORDER_SELECT} ORDER BY o.created_at DESC`));
    rows = rows.filter((o) => {
      const matchSearch = !q || String(o.packagingCode || '').trim().toLocaleLowerCase('vi').startsWith(q);
      const matchMonth = month === 'all' || (o.createdAt ? vnDateKey(new Date(o.createdAt)).slice(0, 7) : '') === month;
      const archived = o.status === 'completed' && orderArchiveDate(o);
      // Đang tìm kiếm → lấy cả 2 tab; không thì chỉ tab đang xem.
      return matchSearch && matchMonth && (q || (view === 'history' ? archived : !archived));
    });

    // Sheet 1: khai báo cột.
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ke hoach');
    ws.columns = [
      { header: 'Số đơn', key: 'orderNumber', width: 18 }, { header: 'Mã bao bì', key: 'packagingCode', width: 20 },
      { header: 'Mã hàng', key: 'itemCode', width: 18 }, { header: 'Cỡ hạt', key: 'grainSize', width: 22 },
      { header: 'Số lượng (tấn)', key: 'quantity', width: 16 }, { header: 'Đã chạy máy', key: 'runOnMachine', width: 16 },
      { header: 'Tồn kho bù', key: 'khoBu', width: 14 }, { header: 'Trạng thái', key: 'statusText', width: 16 },
      { header: 'Ngày tạo', key: 'createdAt', width: 22 }, { header: 'Ngày hoàn thành', key: 'completedAt', width: 22 },
      { header: 'Ngày xuất', key: 'exportDate', width: 18 }, { header: 'Người tạo', key: 'creatorName', width: 20 },
      { header: 'Người chạy', key: 'runnerName', width: 24 }, { header: 'Người xác nhận', key: 'confirmerName', width: 22 },
      { header: 'Máy', key: 'machineName', width: 24 }, { header: 'Lệnh chạy máy', key: 'orderCommand', width: 32 },
    ];
    // Tô dòng tiêu đề: chữ trắng đậm, nền xanh, căn giữa.
    const styleHeader = (r: ExcelJS.Row) => {
      r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF244C75' } };
      r.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      r.height = 30;
    };
    styleHeader(ws.getRow(1));
    // Mỗi đơn 1 dòng; trạng thái dịch sang tiếng Việt, nhiều máy/người thì nối lại.
    const statusNames: Record<string, string> = { new: 'Mới tạo', running: 'Đang chạy', completed: 'Hoàn thành' };
    for (const o of rows) {
      ws.addRow({
        orderNumber: o.orderNumber, packagingCode: o.packagingCode, itemCode: o.itemCode, grainSize: o.grainSize,
        quantity: o.quantity, runOnMachine: o.runOnMachine, khoBu: o.khoBu, statusText: statusNames[o.status] || o.status,
        createdAt: vnCell(o.createdAt), completedAt: vnCell(o.completedAt), exportDate: dayCell(o.exportDate),
        creatorName: o.creatorName, runnerName: o.runnerNames.join(' + ') || o.runnerName,
        confirmerName: o.confirmerName, machineName: o.machineNames.join(', ') || o.machineName, orderCommand: o.orderCommand,
      });
    }
    // Định dạng cột ngày, cố định tiêu đề, bật bộ lọc.
    [9, 10, 11].forEach((n) => (ws.getColumn(n).numFmt = 'dd/mm/yyyy hh:mm'));
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: 'A1', to: 'P1' };

    // Sheet lịch sử gồm sự kiện vận hành thật và nhật ký thao tác đã có.
    const groupIds = [...new Set(rows.map((o) => String(o.parentOrderId || o.id)))];
    const historyWs = wb.addWorksheet('Lich su don hang');
    historyWs.columns = [
      { header: 'Số đơn', key: 'orderNumber', width: 20 },
      { header: 'Thời gian', key: 'time', width: 24 },
      { header: 'Người thực hiện', key: 'person', width: 24 },
      { header: 'Hành động', key: 'action', width: 30 },
      { header: 'Máy', key: 'machine', width: 22 },
      { header: 'Giá trị cũ / Số máy', key: 'oldValue', width: 20 },
      { header: 'Giá trị mới / Sản lượng', key: 'newValue', width: 22 },
      { header: 'Nguồn', key: 'source', width: 18 },
    ];
    styleHeader(historyWs.getRow(1));
    if (groupIds.length) {
      // Lấy id mọi dòng (gốc + chạy thêm) của các nhóm đơn.
      const ids = (await this.db.all<{ id: string }>('SELECT id FROM orders WHERE group_id = ANY(?::text[])', [groupIds])).map((x) => x.id);
      if (ids.length) {
        // Đọc lịch sử thao tác và sự kiện vận hành.
        const historyRows = await this.db.all(
          'SELECT order_id,order_number,machine_name,user_name,action,old_value,new_value,created_at FROM order_history WHERE order_id = ANY(?::text[])',
          [ids],
        );
        const operationRows = await this.db.all(
          'SELECT order_id,order_number,machine_name,user_name,event_type,machine_count,actual_tons,created_at FROM order_events WHERE order_id = ANY(?::text[])',
          [ids],
        );
        // Ghép 2 nguồn thành 1 dòng thời gian, sắp cũ → mới, rồi ghi vào sheet.
        const timeline = [
          ...historyRows.map((x) => ({ orderNumber: x.order_number, time: x.created_at as Date, person: x.user_name, action: x.action, machine: x.machine_name, oldValue: x.old_value, newValue: x.new_value, source: 'Lịch sử thao tác' })),
          ...operationRows.map((x) => ({ orderNumber: x.order_number, time: x.created_at as Date, person: x.user_name, action: x.event_type, machine: x.machine_name, oldValue: x.machine_count, newValue: x.actual_tons, source: 'Vận hành thực tế' })),
        ].sort((a, b) => a.time.getTime() - b.time.getTime());
        timeline.forEach((x) => historyWs.addRow({ ...x, time: vnCell(x.time) }));
      }
    }
    historyWs.getColumn(2).numFmt = 'dd/mm/yyyy hh:mm';
    historyWs.views = [{ state: 'frozen', ySplit: 1 }];
    historyWs.autoFilter = { from: 'A1', to: 'H1' };
    // Xuất file ra dữ liệu nhị phân.
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ---------------------------------------------------------------------------------
  // Tạo đơn
  // ---------------------------------------------------------------------------------
  /** POST /api/orders – tạo đơn mới (trạng thái 'new'); cần admin hoặc quyền 'new'/'all'. */
  @Post()
  @HttpCode(201)
  async create(@Body() body: any, @CurrentUser() u: DbUser) {
    const b = body ?? {};
    // Kiểm quyền tạo đơn.
    const perms = u.role === 'admin' ? ['all'] : orderPerms(u);
    if (u.role !== 'admin' && !perms.includes('new') && !perms.includes('all')) throw new ApiError(403, 'Bạn không có quyền tạo đơn.');
    try {
      // order_number / item_code là NOT NULL ở server cũ → thiếu thì lỗi lưu như cũ.
      if (b.orderNumber === undefined || b.orderNumber === null || b.itemCode === undefined || b.itemCode === null) throw new Error('missing');
      // Lưu ảnh lên Blob, lấy link.
      const image = await this.blob.persistImage(b.imageData, 'orders');
      const now = new Date();
      // Chèn đơn mới vào DB.
      await this.db.run(
        `INSERT INTO orders (id, order_number, item_code, packaging_code, quantity, image_url, whiteness, grain_size, bag_weight, coating_rate,
           stone_type, impurity, pallet, extra_bag, order_command, status, created_at, updated_at, created_by, creator_name, export_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)`,
        [
          newOrderId(6), txt(b.orderNumber), txt(b.itemCode), txt(b.packagingCode), num(b.quantity), image,
          txt(b.whiteness), txt(b.grainSize), txt(b.bagWeight), txt(b.coatingRate), txt(b.stoneType), txt(b.impurity),
          txt(b.pallet), txt(b.extraBag), txt(b.orderCommand), now, now, u.id, u.fullName || '', txt(b.exportDate),
        ],
      );
      return { ok: true };
    } catch (e) {
      // Lỗi khác ApiError → báo chung "Lỗi lưu đơn.".
      if (e instanceof ApiError) throw e;
      throw new ApiError(500, 'Lỗi lưu đơn.');
    }
  }

  // ---------------------------------------------------------------------------------
  // Sửa đơn / đổi trạng thái
  // ---------------------------------------------------------------------------------
  /** PATCH /api/orders/:id – sửa đơn / đổi trạng thái; quyền tùy trường được gửi (xem các bước kiểm tra). */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @CurrentUser() u: DbUser) {
    const b = body ?? {};
    // Đơn phải tồn tại.
    const exists = await this.db.get('SELECT id FROM orders WHERE id = ?', [id]);
    if (!exists) throw new ApiError(404, 'Không tìm thấy đơn hàng.');

    // Xác định quyền: vận hành, xác nhận, Super Admin.
    const isSuper = Boolean(u.isSuper);
    const perms = orderPerms(u);
    const canRun = isSuper || perms.includes('vanhanh') || perms.includes('all');
    const canConfirm = isSuper || perms.includes('xacnhan') || perms.includes('all');
    // Sửa dữ liệu gốc → chỉ Super Admin.
    const attemptsMasterEdit = MASTER_DATA_FIELDS.some((f) => has(b, f));
    if (attemptsMasterEdit && !isSuper) throw new ApiError(403, 'Chỉ Super Admin duy nhất mới được chỉnh sửa dữ liệu đơn hàng.');
    // Sản lượng thực tế → chỉ Super Admin; trường vận hành → cần quyền vận hành; chốt → cần quyền xác nhận.
    const hasRunFields = ['isPaused', 'machineName', 'runOnMachine'].some((k) => has(b, k));
    if (has(b, 'actualProduced') && !isSuper) throw new ApiError(403, 'Sản lượng chỉ được nhập và điều chỉnh tại trang Kho.');
    if ((hasRunFields || b.status === 'running') && !canRun) throw new ApiError(403, 'Bạn chưa được cấp quyền vận hành máy.');
    if (b.status === 'completed' && !canConfirm) throw new ApiError(403, 'Bạn chưa được cấp quyền xác nhận hoàn thành.');

    // Ảnh mới (chỉ Super Admin tới được đây khi có imageData) – upload trước, ngoài transaction.
    const image = b.imageData !== undefined ? await this.blob.persistImage(b.imageData, 'orders') : undefined;

    // Transaction: các bước ghi bên trong thành công hết hoặc hủy hết.
    return this.db.tx(async (t) => {
      // Khóa cả nhóm đơn để không ai sửa chen ngang.
      const locked = await lockOrderGroup(t, id);
      if (!locked) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
      const { row, group } = locked;
      const actor = actorName(u);

      // Người thường chỉ được chuyển sang 'running' hoặc 'completed'.
      if (has(b, 'status') && b.status !== row.status && !['running', 'completed'].includes(b.status) && !isSuper) {
        throw new ApiError(403, 'Bạn không có quyền thay đổi trạng thái đơn hàng này.');
      }

      // Người thường chốt hoàn thành → phải đủ sản lượng, rồi chốt cả nhóm.
      if (b.status === 'completed' && row.status !== 'completed' && !isSuper) {
        const groupId: string = row.parent_order_id || row.id;
        // Số lượng = lớn nhất trong nhóm; thực tế = cộng mọi máy.
        let totalQuantity = 0;
        let totalProduced = 0;
        for (const r of group) {
          totalQuantity = Math.max(totalQuantity, Number(r.quantity) || 0);
          totalProduced += Number(r.actual_produced) || 0;
        }
        if (totalProduced < totalQuantity) {
          throw new ApiError(400, `Không thể chốt! Tổng thực tế mới đạt ${totalProduced}/${totalQuantity} tấn.`);
        }
        // Đánh dấu hoàn thành cả nhóm + ghi lịch sử.
        try {
          const now = new Date();
          await t.run(
            `UPDATE orders SET status = 'completed', completed_at = ?, updated_at = ?, confirmer_name = ? WHERE group_id = ? OR id = ?`,
            [now, now, actor, groupId, groupId],
          );
          await addHistory(t, row as any, 'Tất cả máy', actor, 'Chốt hoàn thành', totalProduced, totalQuantity, now);
        } catch {
          throw new ApiError(500, 'Lỗi khi chốt hoàn thành đơn.');
        }
        return { ok: true };
      }

      // Ngày tạo: chỉ Super Admin được sửa, và phải là ngày hợp lệ.
      if (b.createdAt !== undefined && !isSuper) throw new ApiError(403, 'Chỉ Super Admin mới được sửa ngày tạo đơn.');
      let safeCreatedAt: Date = row.created_at;
      if (b.createdAt !== undefined) {
        const rawDate = String(b.createdAt ?? '').trim();
        const parsed = new Date(rawDate);
        if (!rawDate || Number.isNaN(parsed.getTime())) throw new ApiError(400, 'Ngày tạo không hợp lệ.');
        safeCreatedAt = parsed;
      }

      // Dựng giá trị mới cho mọi cột: trường có gửi → giá trị mới, không gửi → giữ cũ.
      const now = new Date();
      const tv = (k: string, old: string) => (b[k] !== undefined ? txt(b[k]) : old);
      const nv = (k: string, old: number) => (b[k] !== undefined ? num(b[k]) : old);
      const d = {
        order_number: tv('orderNumber', row.order_number),
        item_code: tv('itemCode', row.item_code),
        packaging_code: tv('packagingCode', row.packaging_code),
        quantity: nv('quantity', row.quantity),
        image_url: image !== undefined ? image : row.image_url,
        whiteness: tv('whiteness', row.whiteness),
        grain_size: tv('grainSize', row.grain_size),
        bag_weight: tv('bagWeight', row.bag_weight),
        coating_rate: tv('coatingRate', row.coating_rate),
        stone_type: tv('stoneType', row.stone_type),
        impurity: tv('impurity', row.impurity),
        pallet: tv('pallet', row.pallet),
        extra_bag: tv('extraBag', row.extra_bag),
        order_command: tv('orderCommand', row.order_command || ''),
        run_on_machine: nv('runOnMachine', row.run_on_machine),
        actual_produced: nv('actualProduced', row.actual_produced),
        kho_bu: nv('khoBu', row.kho_bu),
        status: b.status !== undefined ? txt(b.status) : row.status,
        // Hoàn thành → giữ/đặt ngày xong; trạng thái khác → xóa; không đổi → giữ.
        completed_at:
          b.status === 'completed' ? row.completed_at || now : b.status && b.status !== 'completed' ? null : row.completed_at || null,
        is_paused: b.isPaused !== undefined ? Boolean(b.isPaused) : row.is_paused,
        machine_name: tv('machineName', row.machine_name),
        export_date: tv('exportDate', row.export_date),
        created_at: safeCreatedAt,
        creator_name: tv('creatorName', row.creator_name),
        runner_name: tv('runnerName', row.runner_name),
        confirmer_name: tv('confirmerName', row.confirmer_name),
        updated_at: now,
      };
      if (!isSuper) {
        // Người vận hành chỉ cập nhật chữ ký chạy máy; tuyệt đối giữ nguyên người tạo gốc.
        d.creator_name = row.creator_name || '';
        if (b.status === 'running' && row.status !== 'running') d.runner_name = actor;
      } else if (!has(b, 'creatorName')) {
        // Kể cả Super Admin bấm chạy cũng không tự thay đổi chữ ký người tạo.
        d.creator_name = row.creator_name || '';
      }

      try {
        // Ghi mọi cột: UPDATE orders SET cot1 = ?, cot2 = ?… WHERE id = ?
        const cols = Object.keys(d) as (keyof typeof d)[];
        await t.run(`UPDATE orders SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((c) => d[c]), row.id]);

        // Super Admin cập nhật trực tiếp dữ liệu gốc: không tạo audit/history cho các lần sửa tay.
        if (!isSuper) {
          // Ngày tạo đổi → ghi audit_logs (trước/sau).
          if (b.createdAt !== undefined && safeCreatedAt.getTime() !== new Date(row.created_at).getTime()) {
            await t.run(
              `INSERT INTO audit_logs (action_type, target_id, order_number, details, actor, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              ['EDIT_ORDER_CREATED_AT', row.id, row.order_number, JSON.stringify({ before: row.created_at, after: safeCreatedAt }), actor, u.id, now],
            );
          }
          // Ghi lịch sử cho từng thay đổi: trạng thái, tạm dừng, máy, đã chạy, thực tế.
          if (b.status !== undefined && b.status !== row.status) {
            await addHistory(t, row as any, row.machine_name || '', actor, 'Đổi trạng thái', 0, 0, now);
          }
          if (b.isPaused !== undefined && Boolean(b.isPaused) !== Boolean(row.is_paused)) {
            await addHistory(t, row as any, row.machine_name || '', actor, b.isPaused ? 'Tạm dừng máy' : 'Tiếp tục chạy máy', 0, 0, now);
          }
          if (b.machineName !== undefined && String(b.machineName) !== String(row.machine_name || '')) {
            await addHistory(t, row as any, txt(b.machineName), actor, 'Chọn máy vận hành', 0, 0, now);
          }
          if (b.runOnMachine !== undefined && Number(b.runOnMachine) !== Number(row.run_on_machine)) {
            await addHistory(t, row as any, row.machine_name || 'Chưa rõ máy', actor, 'Sửa Đã chạy', row.run_on_machine, b.runOnMachine, now);
          }
          if (b.actualProduced !== undefined && Number(b.actualProduced) !== Number(row.actual_produced)) {
            await addHistory(t, row as any, row.machine_name || 'Chưa rõ máy', actor, 'Sửa Thực tế', row.actual_produced, b.actualProduced, now);
          }
        }
      } catch (e) {
        if (e instanceof ApiError) throw e;
        throw new ApiError(500, 'Lỗi cập nhật.');
      }
      return { ok: true };
    });
  }

  // ---------------------------------------------------------------------------------
  // Xóa đơn (admin)
  // ---------------------------------------------------------------------------------
  /** DELETE /api/orders/:id – xóa 1 dòng đơn (chỉ admin); xóa đơn gốc thì đôn dòng con lên làm gốc. */
  @Delete(':id')
  @RequireAdmin()
  async remove(@Param('id') id: string) {
    await this.db.tx(async (t) => {
      const locked = await lockOrderGroup(t, id);
      if (!locked) return;
      const { row, group } = locked;
      // Xóa đơn gốc còn dòng chạy thêm: FK parent_order_id (ON DELETE SET NULL) sẽ tách các dòng con thành đơn riêng.
      // Giữ nhóm bằng cách đưa dòng con sớm nhất lên làm đơn gốc mới.
      if (!row.parent_order_id) {
        // Dòng con, sắp theo ngày tạo (sớm nhất trước).
        const children = group
          .filter((r) => r.id !== row.id)
          .sort((a, c) => new Date(a.created_at).getTime() - new Date(c.created_at).getTime() || String(a.id).localeCompare(String(c.id)));
        if (children.length) {
          // Dòng con sớm nhất thành gốc mới; các dòng còn lại trỏ về nó.
          const newRoot = children[0];
          await t.run('UPDATE orders SET parent_order_id = NULL WHERE id = ?', [newRoot.id]);
          await t.run('UPDATE orders SET parent_order_id = ? WHERE parent_order_id = ? AND id <> ?', [newRoot.id, row.id, newRoot.id]);
          // Khóa nhóm (group_id) đổi từ id cũ sang id gốc mới -> chuyển dữ liệu kho theo để không bị mồ côi.
          await t.run('UPDATE warehouse_daily_entries SET order_key = ? WHERE order_key = ?', [newRoot.id, row.id]);
          await t.run('UPDATE warehouse_daily_closing_lines SET order_key = ? WHERE order_key = ?', [newRoot.id, row.id]);
          // Baseline sản lượng: chỉ chuyển nếu gốc mới chưa có.
          await t.run(
            `UPDATE warehouse_production_baselines SET order_key = ? WHERE order_key = ?
               AND NOT EXISTS (SELECT 1 FROM warehouse_production_baselines WHERE order_key = ?)`,
            [newRoot.id, row.id, newRoot.id],
          );
        }
      }
      // Xóa dòng đơn.
      await t.run('DELETE FROM orders WHERE id = ?', [row.id]);
    });
    return { ok: true };
  }

  // ---------------------------------------------------------------------------------
  // Vận hành
  // ---------------------------------------------------------------------------------
  /** POST /:id/operations/start – nút "Chạy": bắt đầu chạy đơn trên máy (cần quyền vận hành). */
  @Post(':id/operations/start')
  @HttpCode(200)
  async start(@Param('id') id: string, @Body() body: any, @CurrentUser() u: DbUser) {
    if (!operationPermission(u, 'operate')) throw new ApiError(403, 'Bạn chưa được cấp quyền vận hành máy.');
    return this.db.tx(async (t) => {
      // Khóa đơn; đơn phải còn và chưa hoàn thành.
      const row = await lockOrder(t, id);
      if (!row) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
      if (row.status === 'completed') throw new ApiError(400, 'Đơn đã hoàn thành.');
      // Bắt buộc chọn máy.
      const machine = String(body?.machineName || '').trim();
      if (!machine) throw new ApiError(400, 'Vui lòng chọn tên máy.');
      // Chuyển sang đang chạy, ghi máy + người chạy.
      const now = new Date();
      await t.run(`UPDATE orders SET status = 'running', is_paused = false, machine_name = ?, runner_name = ?, updated_at = ? WHERE id = ?`, [
        machine, actorName(u), now, row.id,
      ]);
      // Ghi sự kiện + lịch sử.
      await addOperationEvent(t, row as any, 'Bắt đầu chạy', machine, 0, 0, u, now);
      await addHistory(t, row as any, machine, actorName(u), 'Bắt đầu chạy', 0, 0, now);
      return { ok: true };
    });
  }

  /** POST /:id/operations/pause – nút "Tạm dừng" (cần quyền vận hành). */
  @Post(':id/operations/pause')
  @HttpCode(200)
  async pause(@Param('id') id: string, @CurrentUser() u: DbUser) {
    if (!operationPermission(u, 'operate')) throw new ApiError(403, 'Bạn chưa được cấp quyền vận hành máy.');
    return this.db.tx(async (t) => {
      const row = await lockOrder(t, id);
      if (!row) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
      if (row.status === 'completed') throw new ApiError(400, 'Đơn đã hoàn thành.');
      // Tạm dừng chỉ đổi trạng thái; không yêu cầu và không ghi đè số máy/sản lượng.
      const now = new Date();
      await t.run('UPDATE orders SET is_paused = true, updated_at = ? WHERE id = ?', [now, row.id]);
      // Ghi sự kiện + lịch sử.
      await addOperationEvent(t, row as any, 'Tạm dừng', row.machine_name, 0, 0, u, now);
      await addHistory(t, row as any, row.machine_name || '', actorName(u), 'Tạm dừng', 0, 0, now);
      return { ok: true };
    });
  }

  /** POST /:id/operations/resume – nút "Chạy tiếp" sau tạm dừng (cần quyền vận hành). */
  @Post(':id/operations/resume')
  @HttpCode(200)
  async resume(@Param('id') id: string, @Body() body: any, @CurrentUser() u: DbUser) {
    if (!operationPermission(u, 'operate')) throw new ApiError(403, 'Bạn chưa được cấp quyền vận hành máy.');
    return this.db.tx(async (t) => {
      // Khóa đơn; chỉ chạy tiếp khi đang tạm dừng.
      const row = await lockOrder(t, id);
      if (!row) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
      if (row.status !== 'running' || !row.is_paused) throw new ApiError(400, 'Chỉ được Chạy tiếp khi đơn hàng đang ở trạng thái Tạm dừng.');
      // Bắt buộc nhập máy.
      const machine = String(body?.machineName || '').trim();
      if (!machine) throw new ApiError(400, 'Vui lòng nhập tên máy tiếp tục chạy.');
      // Bỏ tạm dừng, ghi máy + người chạy.
      const now = new Date();
      await t.run(`UPDATE orders SET status = 'running', is_paused = false, machine_name = ?, runner_name = ?, updated_at = ? WHERE id = ?`, [
        machine, actorName(u), now, row.id,
      ]);
      // Ghi sự kiện + lịch sử.
      await addOperationEvent(t, row as any, 'Chạy tiếp', machine, 0, 0, u, now);
      await addHistory(t, row as any, machine, actorName(u), 'Chạy tiếp', 0, 0, now);
      return { ok: true };
    });
  }

  /** POST /:id/operations/actual – đã ngừng: luôn báo 410, sản lượng nhập ở trang Kho. */
  @Post(':id/operations/actual')
  @HttpCode(200)
  actual() {
    throw new ApiError(410, 'Đã chuyển chức năng nhập sản lượng sang trang Kho. Trang Vận hành chỉ quản lý trạng thái và máy.');
  }

  /** PUT /:id/operations/complete – "Xác nhận hoàn thành" cả nhóm, không kiểm sản lượng (cần quyền xác nhận). */
  @Put(':id/operations/complete')
  async operationsComplete(@Param('id') id: string, @CurrentUser() u: DbUser) {
    if (!operationPermission(u, 'confirm')) throw new ApiError(403, 'Bạn chưa được cấp quyền xác nhận hoàn thành.');
    return this.db.tx(async (t) => {
      const locked = await lockOrderGroup(t, id);
      if (!locked) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
      const { row } = locked;
      // Xác nhận hoàn thành không yêu cầu nhập sản lượng và không tự sửa số liệu sản xuất.
      const now = new Date();
      const actor = actorName(u);
      // Đánh dấu hoàn thành mọi dòng cùng nhóm.
      await t.run(`UPDATE orders SET status = 'completed', completed_at = ?, is_paused = false, confirmer_name = ?, updated_at = ? WHERE group_id = ?`, [
        now, actor, now, row.group_id,
      ]);
      // Ghi sự kiện + lịch sử.
      await addOperationEvent(t, row as any, 'Xác nhận hoàn thành', row.machine_name, 0, 0, u, now);
      await addHistory(t, row as any, '', actor, 'Xác nhận hoàn thành', 0, 0, now);
      return { ok: true };
    });
  }

  /** GET /:id/operations – dòng thời gian sự kiện vận hành của cả nhóm đơn (cũ → mới). */
  @Get(':id/operations')
  async operations(@Param('id') id: string) {
    // Tìm mã nhóm của đơn.
    const row = await this.db.get<{ group_id: string }>('SELECT group_id FROM orders WHERE id = ?', [id]);
    if (!row) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
    // Lấy sự kiện của mọi dòng trong nhóm.
    return this.db.all(
      `SELECT e.* FROM order_events e
       JOIN orders o ON o.id = e.order_id
       WHERE o.group_id = ?
       ORDER BY e.created_at ASC, e.id ASC`,
      [row.group_id],
    );
  }

  // ---------------------------------------------------------------------------------
  // Chạy thêm máy (tách dòng)
  // ---------------------------------------------------------------------------------
  /** POST /:id/split – "Chạy thêm máy": tạo dòng con chạy song song trên máy khác (cần quyền vận hành). */
  @Post(':id/split')
  @HttpCode(200)
  async split(@Param('id') id: string, @Body() body: any, @CurrentUser() u: DbUser) {
    const perms = orderPerms(u);
    if (!u.isSuper && !perms.includes('vanhanh') && !perms.includes('all')) throw new ApiError(403, 'Bạn chưa được cấp quyền vận hành máy.');
    return this.db.tx(async (t) => {
      const locked = await lockOrderGroup(t, id);
      if (!locked) throw new ApiError(404, 'Không tìm thấy đơn hàng gốc.');
      const { row, group } = locked;
      // Nhóm phải đang chạy (không tạm dừng).
      const groupIsRunning = group.some((x: Row) => x.status === 'running' && !x.is_paused);
      if (!groupIsRunning) {
        throw new ApiError(400, 'Chỉ được chạy thêm máy khi đơn hàng đang chạy (màu xanh dương). Hãy bấm Chạy tiếp trước nếu đơn đang tạm dừng.');
      }
      // Bắt buộc nhập máy mới.
      const machineName = String(body?.machineName || '').trim();
      if (!machineName) throw new ApiError(400, 'Vui lòng nhập tên máy mới.');
      try {
        const newId = newOrderId(4);
        const now = new Date();
        // Chèn dòng con: sao chép thông số đơn gốc, đã chạy/thực tế = 0, trạng thái 'running'.
        await t.run(
          `INSERT INTO orders (
             id, parent_order_id, order_number, item_code, packaging_code, quantity, image_url, whiteness, grain_size,
             bag_weight, coating_rate, stone_type, impurity, pallet, extra_bag,
             run_on_machine, actual_produced, status, machine_name, created_at, updated_at, created_by, creator_name
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'running', ?, ?, ?, ?, ?)`,
          [
            newId, row.parent_order_id || row.id, row.order_number, row.item_code, row.packaging_code, row.quantity, row.image_url,
            row.whiteness, row.grain_size, row.bag_weight, row.coating_rate, row.stone_type, row.impurity, row.pallet, row.extra_bag,
            machineName, now, now, u.id, u.fullName || '',
          ],
        );
        // Ghi riêng sự kiện Chạy thêm máy để bộ phận kho tổng hợp cuối ngày.
        await addOperationEvent(t, { id: newId, order_number: row.order_number }, 'Chạy thêm máy', machineName, 0, 0, u, now);
        await addHistory(t, { id: newId, order_number: row.order_number }, machineName, actorName(u), 'Chạy thêm máy', 0, 0, now);
      } catch {
        throw new ApiError(500, 'Lỗi khi tạo dòng chạy thêm.');
      }
      return { ok: true };
    });
  }

  // ---------------------------------------------------------------------------------
  // Xác nhận hoàn thành (kiểm tra đủ sản lượng)
  // ---------------------------------------------------------------------------------
  /** PUT /:id/complete – xác nhận hoàn thành, bắt buộc tổng thực tế ≥ số lượng (cần quyền xác nhận). */
  @Put(':id/complete')
  async complete(@Param('id') id: string, @CurrentUser() u: DbUser) {
    return this.db.tx(async (t) => {
      const locked = await lockOrderGroup(t, id);
      if (!locked) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
      // Kiểm quyền xác nhận.
      const perms = orderPerms(u);
      if (!u.isSuper && !perms.includes('xacnhan') && !perms.includes('all')) throw new ApiError(403, 'Bạn chưa được cấp quyền xác nhận hoàn thành.');
      const { row, group } = locked;
      // Số lượng = lớn nhất trong nhóm; thực tế = cộng mọi máy; thiếu → 400.
      const qty = Math.max(...group.map((x: Row) => Number(x.quantity) || 0));
      const produced = group.reduce((sum: number, x: Row) => sum + (Number(x.actual_produced) || 0), 0);
      if (produced < qty) throw new ApiError(400, `Chưa đủ sản lượng: ${produced}/${qty} tấn.`);
      // Đánh dấu hoàn thành cả nhóm + ghi lịch sử.
      const now = new Date();
      const actor = actorName(u);
      await t.run(`UPDATE orders SET status = 'completed', completed_at = ?, is_paused = false, updated_at = ?, confirmer_name = ? WHERE group_id = ?`, [
        now, now, actor, row.group_id,
      ]);
      await addHistory(t, row as any, 'Tất cả máy', actor, 'Xác nhận hoàn thành đơn', produced, qty, now);
      return { ok: true };
    });
  }
}
