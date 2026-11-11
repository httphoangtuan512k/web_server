/**
 * FILE NÀY LÀM GÌ:
 *   Định nghĩa toàn bộ API của phần ĐƠN HÀNG (đường dẫn bắt đầu bằng /api/orders):
 *   xem danh sách, xuất Excel kế hoạch, tạo đơn, sửa đơn, xóa đơn, và các thao tác vận hành
 *   (bắt đầu chạy, tạm dừng, chạy tiếp, chạy thêm máy, xác nhận / chốt hoàn thành).
 *
 * AI/CHỖ NÀO DÙNG NÓ:
 *   - Trang "Kế hoạch" (app/(app)/ke-hoach): xem danh sách, tạo/sửa/xóa đơn, xuất Excel, xem dòng thời gian vận hành.
 *   - Trang "Vận hành" (app/(app)/van-hanh): bấm Chạy / Tạm dừng / Chạy tiếp / Chạy thêm máy / Xác nhận hoàn thành.
 *
 * LUỒNG CHÍNH:
 *   - GET    /api/orders                         → danh sách đơn + cờ quyền (được tạo/sửa/xóa/vận hành/xác nhận?).
 *   - GET    /api/orders/export                  → tải file Excel kế hoạch (2 sheet: đơn hàng + lịch sử).
 *   - POST   /api/orders                         → tạo đơn mới (trạng thái 'new').
 *   - PATCH  /api/orders/:id                     → sửa đơn / đổi trạng thái (kiểm tra quyền rất kỹ).
 *   - DELETE /api/orders/:id                     → xóa đơn (chỉ admin).
 *   - POST   /api/orders/:id/operations/start    → bắt đầu chạy trên một máy.
 *   - POST   /api/orders/:id/operations/pause    → tạm dừng.
 *   - POST   /api/orders/:id/operations/resume   → chạy tiếp.
 *   - POST   /api/orders/:id/operations/actual   → (đã ngừng) nhập sản lượng – giờ làm ở trang Kho.
 *   - PUT    /api/orders/:id/operations/complete → xác nhận hoàn thành (không kiểm tra sản lượng).
 *   - GET    /api/orders/:id/operations          → danh sách sự kiện vận hành của cả nhóm đơn.
 *   - POST   /api/orders/:id/split               → chạy thêm máy (tạo thêm 1 dòng con của đơn gốc).
 *   - PUT    /api/orders/:id/complete            → xác nhận hoàn thành, BẮT BUỘC đủ sản lượng.
 *
 * KHÁI NIỆM HAY GẶP TRONG FILE:
 *   - Decorator: dòng bắt đầu bằng @ (vd @Get, @Post) đặt trên hàm để NestJS biết hàm đó ứng với đường dẫn nào.
 *   - async/await: hàm `async` có thể "chờ" (`await`) việc tốn thời gian như đọc/ghi DB rồi mới chạy tiếp.
 *   - `throw new ApiError(mã, 'thông báo')`: dừng xử lý ngay và trả lỗi về trang web (403 = không có quyền,
 *     404 = không tìm thấy, 400 = dữ liệu không hợp lệ, 500 = lỗi máy chủ).
 *   - Transaction (`this.db.tx`): gói nhiều lệnh ghi DB thành "một khối": hoặc tất cả thành công,
 *     hoặc nếu có lỗi thì hủy hết (không để dữ liệu nửa vời).
 */
// Lấy các decorator của NestJS: Body (đọc dữ liệu gửi lên), Controller (khai báo nhóm API), Delete/Get/Patch/Post/Put
// (loại yêu cầu HTTP), HttpCode (mã trả về), Param (đọc phần :id trên đường dẫn), Query (đọc ?a=b), Res (đối tượng trả lời).
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
// ExcelJS = thư viện tạo/đọc file Excel (.xlsx) bằng code.
import ExcelJS from 'exceljs';
// Kiểu "Response" của Express (thư viện web bên dưới NestJS) – dùng để tự gửi file về trình duyệt.
import type { Response } from 'express';
// Kiểu thông tin người dùng đang đăng nhập.
import type { DbUser } from '../../auth/auth.types';
// CurrentUser: lấy người đang đăng nhập; RequireAdmin: chỉ admin được gọi; RequirePage: phải có quyền vào trang đó.
import { CurrentUser, RequireAdmin, RequirePage } from '../../auth/decorators';
// Dịch vụ lưu ảnh/tệp lên Vercel Blob (kho lưu trữ tệp trên mạng).
import { BlobService } from '../../blob/blob.service';
// Lớp lỗi chuẩn của dự án: mang theo mã lỗi HTTP + thông báo tiếng Việt.
import { ApiError } from '../../common/api-error';
// Hàm lấy ngày theo giờ Việt Nam dạng 'YYYY-MM-DD'.
import { vnDateKey } from '../../common/time';
// DbService: dịch vụ chạy câu SQL với Postgres; Row: kiểu một dòng dữ liệu.
import { DbService, Row } from '../../db/db.service';
// Các hàm tiện ích của phần đơn hàng (xem giải thích chi tiết trong orders.helpers.ts).
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

/** Kiểm tra đối tượng `o` có thật sự chứa trường tên `k` hay không (kể cả khi giá trị là rỗng). */
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
/** Chuỗi cho cột text NOT NULL (null/undefined → ''). NOT NULL = cột trong DB không được để trống. */
const txt = (v: unknown) => (v === undefined || v === null ? '' : String(v));
/** Số cho cột double NOT NULL (giá trị không phải số → 0). */
const num = (v: unknown) => {
  // Thử đổi sang số.
  const n = Number(v);
  // Là số hữu hạn thì dùng, không thì 0.
  return Number.isFinite(n) ? n : 0;
};
// Chênh lệch giờ Việt Nam so với giờ quốc tế: 7 tiếng, đổi ra mili giây (7 × 60 phút × 60 giây × 1000).
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Excel không có múi giờ (exceljs ghi theo UTC) → dịch sang giờ VN để ô hiển thị đúng giờ địa phương. */
const vnCell = (v: unknown): Date | null => {
  // Không có giá trị → ô để trống.
  if (!v) return null;
  // Nếu đã là ngày giờ (Date) thì dùng luôn, không thì đổi chuỗi sang Date.
  const d = v instanceof Date ? v : new Date(String(v));
  // Ngày không hợp lệ → trống; hợp lệ → cộng thêm 7 tiếng.
  return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() + VN_OFFSET_MS);
};
/** Ngày xuất ('YYYY-MM-DD' từ input date) giữ nguyên ngày. */
const dayCell = (v: unknown): Date | null => {
  // Không có giá trị → trống.
  if (!v) return null;
  const s = String(v);
  // Nếu đúng dạng 'YYYY-MM-DD' (kiểm tra bằng biểu thức chính quy – regex) thì tạo ngày lúc 00:00, không cộng giờ.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  // Dạng khác (có giờ) → xử lý như ngày giờ bình thường.
  return vnCell(s);
};

// Danh sách "trường dữ liệu gốc" của đơn. Nếu yêu cầu sửa có chứa bất kỳ trường nào ở đây
// thì chỉ Super Admin mới được phép (người vận hành không được tự đổi số đơn, số lượng…).
const MASTER_DATA_FIELDS = [
  'orderNumber', 'itemCode', 'packagingCode', 'quantity', 'imageData',
  'whiteness', 'grainSize', 'bagWeight', 'coatingRate', 'stoneType',
  'impurity', 'pallet', 'extraBag', 'orderCommand', 'khoBu', 'exportDate', 'createdAt',
  'creatorName', 'runnerName', 'confirmerName',
];

// @Controller('api/orders'): mọi hàm trong lớp này có đường dẫn bắt đầu bằng /api/orders.
// Mặc định mọi API đều yêu cầu đăng nhập (bộ bảo vệ chung của ứng dụng kiểm tra trước).
@Controller('api/orders')
export class OrdersController {
  // Hàm khởi tạo: NestJS tự "tiêm" (đưa vào) dịch vụ DB và dịch vụ lưu ảnh để dùng trong lớp.
  // `private readonly` = biến riêng của lớp, không được gán lại.
  constructor(private readonly db: DbService, private readonly blob: BlobService) {}

  // ---------------------------------------------------------------------------------
  // Danh sách
  // ---------------------------------------------------------------------------------
  /**
   * GET /api/orders – Lấy toàn bộ đơn hàng (mới nhất trước) cùng các cờ quyền của người đang xem.
   * - Ai gọi: mọi người đã đăng nhập (trang Kế hoạch, trang Vận hành dùng để hiển thị và bật/tắt nút).
   * - Nhận: không có tham số.
   * - Trả về: { orders: [...], permissions, canCreate, canEdit, canDelete, canOperate, canConfirm, isSuper }.
   */
  @Get()
  async list(@CurrentUser() u: DbUser) {
    // Danh sách quyền đơn hàng của người dùng.
    const perms = orderPerms(u);
    // Có phải Super Admin không.
    const isSuper = Boolean(u.isSuper);
    // Lấy mọi đơn kèm tên người tạo, sắp xếp theo ngày tạo giảm dần (DESC = mới nhất lên đầu).
    const rows = await this.db.all(`${ORDER_SELECT} ORDER BY o.created_at DESC`);
    // Trả kết quả về trang web.
    return {
      // `rows.map(f)` = áp hàm f cho từng phần tử, tạo mảng mới: đổi dòng thô thành dạng camelCase.
      orders: rows.map(orderFromRow),
      permissions: perms,
      // Các cờ: Super Admin luôn được; người thường cần đúng mã quyền
      // ('new' = tạo, 'edit' = sửa, 'delete' = xóa, 'vanhanh' = vận hành, 'xacnhan' = xác nhận, 'all' = tất cả).
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
  /**
   * GET /api/orders/export?search=…&view=active|history&month=YYYY-MM – Tải file Excel kế hoạch.
   * - Ai gọi: người có quyền vào trang "Kế hoạch" (@RequirePage('kehoach')); admin luôn được.
   * - Nhận: bộ lọc giống ô tìm kiếm trên trang (mã bao bì, tab đang xem, tháng).
   * - Trả về: file ke_hoach_<ngày>.xlsx để trình duyệt tải xuống.
   * - Lỗi: 500 "Không thể xuất Excel kế hoạch." nếu tạo file thất bại.
   */
  @Get('export')
  @RequirePage('kehoach')
  async export(@Query() query: Record<string, unknown>, @Res() res: Response) {
    // Biến chứa nội dung file (Buffer = khối dữ liệu nhị phân trong bộ nhớ).
    let buffer: Buffer;
    // try/catch: thử chạy khối `try`; nếu có lỗi thì nhảy sang `catch` để xử lý thay vì làm sập máy chủ.
    try {
      // Tạo file Excel theo bộ lọc.
      buffer = await this.buildExport(query);
    } catch (e) {
      // Ghi lỗi chi tiết vào nhật ký máy chủ để lập trình viên tra cứu.
      console.error('[KẾ HOẠCH] Lỗi xuất Excel:', e);
      // Trả lỗi dễ hiểu về trang web.
      throw new ApiError(500, 'Không thể xuất Excel kế hoạch.');
    }
    // Tên file, vd "ke_hoach_2026-11-11.xlsx".
    const name = `ke_hoach_${vnDateKey()}.xlsx`;
    // Báo cho trình duyệt đây là file Excel.
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // Báo trình duyệt "tải xuống" (attachment) với tên file trên (kèm bản mã hóa UTF-8 cho tên có dấu).
    res.setHeader('Content-Disposition', `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    // Gửi nội dung file về.
    res.send(buffer);
  }

  /**
   * Hàm nội bộ (`private` = chỉ dùng trong lớp này) tạo file Excel kế hoạch.
   * - Sheet 1 "Ke hoach": mỗi đơn (đã gộp các máy) là 1 dòng.
   * - Sheet 2 "Lich su don hang": dòng thời gian gồm lịch sử thao tác + sự kiện vận hành của các đơn đó.
   * - Trả về: nội dung file .xlsx dạng Buffer.
   */
  private async buildExport(query: Record<string, unknown>): Promise<Buffer> {
    // Từ khóa tìm kiếm: bỏ khoảng trắng đầu/cuối và đổi về chữ thường (theo tiếng Việt) để so sánh không phân biệt hoa/thường.
    const q = String(query.search || '').trim().toLocaleLowerCase('vi');
    // Tab đang xem: 'active' (đơn hiện hành) hoặc 'history' (đơn đã lưu lịch sử). Mặc định 'active'.
    const view = String(query.view || 'active');
    // Tháng lọc dạng 'YYYY-MM', hoặc 'all' = mọi tháng.
    const month = String(query.month || 'all');
    // Lấy mọi đơn (mới nhất trước) rồi gộp các dòng chạy thêm máy về đơn gốc. `let` = biến có thể gán lại sau.
    let rows = groupedOrderRows(await this.db.all(`${ORDER_SELECT} ORDER BY o.created_at DESC`));
    // `filter` = giữ lại những phần tử thỏa điều kiện (hàm trả về true).
    rows = rows.filter((o) => {
      // Khớp tìm kiếm: không có từ khóa, hoặc mã bao bì bắt đầu bằng từ khóa.
      const matchSearch = !q || String(o.packagingCode || '').trim().toLocaleLowerCase('vi').startsWith(q);
      // Khớp tháng: chọn "tất cả", hoặc tháng tạo đơn (7 ký tự đầu 'YYYY-MM' của ngày giờ VN) trùng tháng lọc.
      const matchMonth = month === 'all' || (o.createdAt ? vnDateKey(new Date(o.createdAt)).slice(0, 7) : '') === month;
      // Đơn đã hoàn thành quá 3 tháng → thuộc tab Lịch sử.
      const archived = o.status === 'completed' && orderArchiveDate(o);
      // Khi đang tìm kiếm thì lấy cả 2 tab; không tìm kiếm thì chỉ lấy đúng tab đang xem.
      return matchSearch && matchMonth && (q || (view === 'history' ? archived : !archived));
    });

    // Tạo một sổ Excel mới (Workbook) và thêm trang tính (Worksheet) tên "Ke hoach".
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ke hoach');
    // Khai báo các cột: header = tiêu đề hiển thị, key = tên trường dữ liệu, width = độ rộng cột.
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
    // Hàm tô định dạng dòng tiêu đề: chữ đậm màu trắng, nền xanh đậm, căn giữa, tự xuống dòng, cao 30.
    const styleHeader = (r: ExcelJS.Row) => {
      r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF244C75' } };
      r.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      r.height = 30;
    };
    // Áp định dạng cho dòng 1 (dòng tiêu đề).
    styleHeader(ws.getRow(1));
    // Bảng đổi mã trạng thái sang chữ tiếng Việt. `Record<string, string>` = đối tượng khóa chữ → giá trị chữ.
    const statusNames: Record<string, string> = { new: 'Mới tạo', running: 'Đang chạy', completed: 'Hoàn thành' };
    // Thêm từng đơn thành một dòng Excel.
    for (const o of rows) {
      ws.addRow({
        orderNumber: o.orderNumber, packagingCode: o.packagingCode, itemCode: o.itemCode, grainSize: o.grainSize,
        // Trạng thái: dịch sang tiếng Việt; mã lạ thì giữ nguyên.
        quantity: o.quantity, runOnMachine: o.runOnMachine, khoBu: o.khoBu, statusText: statusNames[o.status] || o.status,
        // Ngày giờ đổi sang giờ VN; ngày xuất giữ nguyên ngày.
        createdAt: vnCell(o.createdAt), completedAt: vnCell(o.completedAt), exportDate: dayCell(o.exportDate),
        // Nhiều người chạy thì nối bằng " + " (`join` = ghép các phần tử mảng thành 1 chuỗi).
        creatorName: o.creatorName, runnerName: o.runnerNames.join(' + ') || o.runnerName,
        // Nhiều máy thì nối bằng ", ".
        confirmerName: o.confirmerName, machineName: o.machineNames.join(', ') || o.machineName, orderCommand: o.orderCommand,
      });
    }
    // Cột 9, 10, 11 (Ngày tạo, Ngày hoàn thành, Ngày xuất) hiển thị dạng ngày/tháng/năm giờ:phút.
    [9, 10, 11].forEach((n) => (ws.getColumn(n).numFmt = 'dd/mm/yyyy hh:mm'));
    // Cố định dòng tiêu đề khi cuộn xuống.
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    // Bật nút lọc (autofilter) cho các cột A → P.
    ws.autoFilter = { from: 'A1', to: 'P1' };

    // Sheet lịch sử gồm sự kiện vận hành thật và nhật ký thao tác đã có.
    // Danh sách mã đơn gốc (không trùng). `Set` = tập hợp tự loại bỏ phần tử trùng.
    const groupIds = [...new Set(rows.map((o) => String(o.parentOrderId || o.id)))];
    // Thêm trang tính thứ 2 cho lịch sử.
    const historyWs = wb.addWorksheet('Lich su don hang');
    // Khai báo cột của sheet lịch sử.
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
    // Định dạng dòng tiêu đề sheet lịch sử.
    styleHeader(historyWs.getRow(1));
    // Chỉ truy vấn khi có ít nhất 1 đơn.
    if (groupIds.length) {
      // Lấy id của mọi dòng (đơn gốc + dòng chạy thêm) thuộc các nhóm trên.
      // `ANY(?::text[])` = "nằm trong danh sách" – truyền cả mảng vào một dấu `?`.
      const ids = (await this.db.all<{ id: string }>('SELECT id FROM orders WHERE group_id = ANY(?::text[])', [groupIds])).map((x) => x.id);
      if (ids.length) {
        // Lấy lịch sử thao tác (bảng order_history) của các dòng đó.
        const historyRows = await this.db.all(
          'SELECT order_id,order_number,machine_name,user_name,action,old_value,new_value,created_at FROM order_history WHERE order_id = ANY(?::text[])',
          [ids],
        );
        // Lấy sự kiện vận hành (bảng order_events) của các dòng đó.
        const operationRows = await this.db.all(
          'SELECT order_id,order_number,machine_name,user_name,event_type,machine_count,actual_tons,created_at FROM order_events WHERE order_id = ANY(?::text[])',
          [ids],
        );
        // Ghép 2 nguồn thành 1 dòng thời gian chung (cùng tên trường), ghi rõ "Nguồn",
        // rồi `sort` = sắp xếp theo thời gian tăng dần (cũ trước, mới sau).
        const timeline = [
          ...historyRows.map((x) => ({ orderNumber: x.order_number, time: x.created_at as Date, person: x.user_name, action: x.action, machine: x.machine_name, oldValue: x.old_value, newValue: x.new_value, source: 'Lịch sử thao tác' })),
          ...operationRows.map((x) => ({ orderNumber: x.order_number, time: x.created_at as Date, person: x.user_name, action: x.event_type, machine: x.machine_name, oldValue: x.machine_count, newValue: x.actual_tons, source: 'Vận hành thực tế' })),
        ].sort((a, b) => a.time.getTime() - b.time.getTime());
        // Thêm từng mục vào sheet, thời gian đổi sang giờ VN.
        timeline.forEach((x) => historyWs.addRow({ ...x, time: vnCell(x.time) }));
      }
    }
    // Cột 2 (Thời gian) hiển thị dạng ngày giờ.
    historyWs.getColumn(2).numFmt = 'dd/mm/yyyy hh:mm';
    // Cố định dòng tiêu đề và bật bộ lọc cột A → H.
    historyWs.views = [{ state: 'frozen', ySplit: 1 }];
    historyWs.autoFilter = { from: 'A1', to: 'H1' };
    // Xuất sổ Excel ra dữ liệu nhị phân và trả về.
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ---------------------------------------------------------------------------------
  // Tạo đơn
  // ---------------------------------------------------------------------------------
  /**
   * POST /api/orders – Tạo đơn hàng mới (trạng thái 'new' = Mới tạo).
   * - Ai gọi: form "Tạo đơn" trang Kế hoạch. Cần role admin, hoặc quyền đơn hàng 'new' / 'all'.
   * - Nhận (body): orderNumber, itemCode (bắt buộc), packagingCode, quantity, imageData (ảnh dạng data URL hoặc link),
   *   whiteness, grainSize, bagWeight, coatingRate, stoneType, impurity, pallet, extraBag, orderCommand, exportDate.
   * - Trả về: { ok: true }; mã HTTP 201 (= "đã tạo").
   * - Lỗi: 403 không có quyền; 500 "Lỗi lưu đơn." (thiếu số đơn / mã hàng, hoặc lỗi DB).
   */
  @Post()
  @HttpCode(201)
  async create(@Body() body: any, @CurrentUser() u: DbUser) {
    // Dữ liệu gửi lên; nếu trống thì dùng đối tượng rỗng {} để không bị lỗi khi đọc trường.
    const b = body ?? {};
    // Admin coi như có mọi quyền; người khác lấy từ danh sách quyền đơn hàng.
    const perms = u.role === 'admin' ? ['all'] : orderPerms(u);
    // Không phải admin và không có quyền 'new' hay 'all' → chặn.
    if (u.role !== 'admin' && !perms.includes('new') && !perms.includes('all')) throw new ApiError(403, 'Bạn không có quyền tạo đơn.');
    try {
      // order_number / item_code là NOT NULL ở server cũ → thiếu thì lỗi lưu như cũ.
      if (b.orderNumber === undefined || b.orderNumber === null || b.itemCode === undefined || b.itemCode === null) throw new Error('missing');
      // Lưu ảnh lên Vercel Blob (nếu là ảnh mới dạng data URL) và nhận lại đường dẫn ảnh.
      const image = await this.blob.persistImage(b.imageData, 'orders');
      // Thời điểm hiện tại, dùng cho ngày tạo và ngày cập nhật.
      const now = new Date();
      // Chèn đơn mới vào bảng orders. Trạng thái ghi cứng là 'new'.
      await this.db.run(
        `INSERT INTO orders (id, order_number, item_code, packaging_code, quantity, image_url, whiteness, grain_size, bag_weight, coating_rate,
           stone_type, impurity, pallet, extra_bag, order_command, status, created_at, updated_at, created_by, creator_name, export_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)`,
        // Giá trị theo đúng thứ tự cột: mã đơn mới, các trường chữ (txt) / số (num), thời điểm,
        // id người tạo (created_by), họ tên người tạo (creator_name), ngày xuất.
        [
          newOrderId(6), txt(b.orderNumber), txt(b.itemCode), txt(b.packagingCode), num(b.quantity), image,
          txt(b.whiteness), txt(b.grainSize), txt(b.bagWeight), txt(b.coatingRate), txt(b.stoneType), txt(b.impurity),
          txt(b.pallet), txt(b.extraBag), txt(b.orderCommand), now, now, u.id, u.fullName || '', txt(b.exportDate),
        ],
      );
      // Báo thành công.
      return { ok: true };
    } catch (e) {
      // Lỗi đã có mã rõ ràng (ApiError) thì trả nguyên lỗi đó.
      if (e instanceof ApiError) throw e;
      // Lỗi khác (thiếu dữ liệu, lỗi DB, lỗi lưu ảnh…) → báo chung "Lỗi lưu đơn.".
      throw new ApiError(500, 'Lỗi lưu đơn.');
    }
  }

  // ---------------------------------------------------------------------------------
  // Sửa đơn / đổi trạng thái
  // ---------------------------------------------------------------------------------
  /**
   * PATCH /api/orders/:id – Sửa đơn hoặc đổi trạng thái (form sửa ở trang Kế hoạch, một số nút ở trang Vận hành).
   * - Ai gọi / quyền:
   *   + Sửa dữ liệu gốc (số đơn, số lượng, ảnh…, xem MASTER_DATA_FIELDS): chỉ Super Admin.
   *   + Sửa "sản lượng thực tế": chỉ Super Admin (người thường nhập ở trang Kho).
   *   + Đổi máy / tạm dừng / đã chạy / chuyển 'running': cần quyền vận hành ('vanhanh' hoặc 'all').
   *   + Chuyển 'completed' (chốt hoàn thành): cần quyền xác nhận ('xacnhan' hoặc 'all') và đủ sản lượng.
   * - Nhận: `:id` trên đường dẫn + body chứa các trường muốn đổi (chỉ trường nào gửi lên mới bị đổi).
   * - Trả về: { ok: true }.
   * - Lỗi: 404 không có đơn; 403 thiếu quyền; 400 chưa đủ sản lượng / ngày tạo sai; 500 lỗi ghi DB.
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @CurrentUser() u: DbUser) {
    // Dữ liệu gửi lên (rỗng thì dùng {}).
    const b = body ?? {};
    // Kiểm tra nhanh đơn có tồn tại không (trước khi làm việc nặng như upload ảnh).
    const exists = await this.db.get('SELECT id FROM orders WHERE id = ?', [id]);
    if (!exists) throw new ApiError(404, 'Không tìm thấy đơn hàng.');

    // Xác định quyền của người đang sửa.
    const isSuper = Boolean(u.isSuper);
    const perms = orderPerms(u);
    // Được vận hành máy?
    const canRun = isSuper || perms.includes('vanhanh') || perms.includes('all');
    // Được xác nhận hoàn thành?
    const canConfirm = isSuper || perms.includes('xacnhan') || perms.includes('all');
    // Có đang cố sửa trường dữ liệu gốc nào không? (`some` = có ít nhất 1 phần tử thỏa điều kiện).
    const attemptsMasterEdit = MASTER_DATA_FIELDS.some((f) => has(b, f));
    // Sửa dữ liệu gốc mà không phải Super Admin → chặn.
    if (attemptsMasterEdit && !isSuper) throw new ApiError(403, 'Chỉ Super Admin duy nhất mới được chỉnh sửa dữ liệu đơn hàng.');
    // Có gửi trường liên quan vận hành (tạm dừng, tên máy, đã chạy) không?
    const hasRunFields = ['isPaused', 'machineName', 'runOnMachine'].some((k) => has(b, k));
    // Sửa sản lượng thực tế mà không phải Super Admin → chặn (phải nhập ở trang Kho).
    if (has(b, 'actualProduced') && !isSuper) throw new ApiError(403, 'Sản lượng chỉ được nhập và điều chỉnh tại trang Kho.');
    // Thao tác vận hành mà không có quyền vận hành → chặn.
    if ((hasRunFields || b.status === 'running') && !canRun) throw new ApiError(403, 'Bạn chưa được cấp quyền vận hành máy.');
    // Chốt hoàn thành mà không có quyền xác nhận → chặn.
    if (b.status === 'completed' && !canConfirm) throw new ApiError(403, 'Bạn chưa được cấp quyền xác nhận hoàn thành.');

    // Ảnh mới (chỉ Super Admin tới được đây khi có imageData) – upload trước, ngoài transaction.
    // (Upload tốn thời gian; làm trước để không giữ khóa DB lâu.) Không gửi ảnh thì để undefined = giữ ảnh cũ.
    const image = b.imageData !== undefined ? await this.blob.persistImage(b.imageData, 'orders') : undefined;

    // Mở transaction: mọi lệnh ghi bên trong hoặc thành công hết, hoặc hủy hết nếu có lỗi.
    // `t` là "kết nối trong transaction", dùng thay cho this.db ở bên trong.
    return this.db.tx(async (t) => {
      // Khóa cả nhóm đơn (đơn gốc + các dòng chạy thêm) để không ai sửa chen ngang.
      const locked = await lockOrderGroup(t, id);
      // Đơn đã bị xóa trong lúc chờ → 404.
      if (!locked) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
      // Tách ra: row = dòng đang sửa, group = cả nhóm. (Cú pháp `{ a, b } = obj` gọi là "destructuring".)
      const { row, group } = locked;
      // Tên người thao tác (ghi chữ ký / nhật ký).
      const actor = actorName(u);

      // Người thường chỉ được đổi trạng thái sang 'running' hoặc 'completed' (vd không được đưa về 'new').
      if (has(b, 'status') && b.status !== row.status && !['running', 'completed'].includes(b.status) && !isSuper) {
        throw new ApiError(403, 'Bạn không có quyền thay đổi trạng thái đơn hàng này.');
      }

      // Trường hợp đặc biệt: người thường "chốt hoàn thành" → kiểm tra đủ sản lượng rồi chốt cả nhóm.
      if (b.status === 'completed' && row.status !== 'completed' && !isSuper) {
        // Mã nhóm = mã đơn gốc.
        const groupId: string = row.parent_order_id || row.id;
        // Số lượng yêu cầu của đơn và tổng sản lượng thực tế cộng từ mọi máy.
        let totalQuantity = 0;
        let totalProduced = 0;
        for (const r of group) {
          // Các dòng chạy thêm sao chép số lượng của đơn gốc, nên lấy số lớn nhất (không cộng dồn).
          totalQuantity = Math.max(totalQuantity, Number(r.quantity) || 0);
          // Sản lượng thực tế thì cộng dồn từ tất cả các máy.
          totalProduced += Number(r.actual_produced) || 0;
        }
        // Chưa đủ sản lượng → không cho chốt. Vd "Tổng thực tế mới đạt 80/100 tấn."
        if (totalProduced < totalQuantity) {
          throw new ApiError(400, `Không thể chốt! Tổng thực tế mới đạt ${totalProduced}/${totalQuantity} tấn.`);
        }
        try {
          const now = new Date();
          // Đánh dấu hoàn thành cho mọi dòng thuộc nhóm (dòng gốc và các dòng con), ghi người xác nhận.
          await t.run(
            `UPDATE orders SET status = 'completed', completed_at = ?, updated_at = ?, confirmer_name = ? WHERE group_id = ? OR id = ?`,
            [now, now, actor, groupId, groupId],
          );
          // Ghi lịch sử "Chốt hoàn thành" (giá trị cũ = tổng sản lượng, giá trị mới = số lượng yêu cầu).
          // `row as any` = bỏ qua kiểm tra kiểu của TypeScript cho dòng này.
          await addHistory(t, row as any, 'Tất cả máy', actor, 'Chốt hoàn thành', totalProduced, totalQuantity, now);
        } catch {
          // Lỗi DB → báo lỗi (transaction tự hủy các thay đổi).
          throw new ApiError(500, 'Lỗi khi chốt hoàn thành đơn.');
        }
        // Xong việc chốt, trả về luôn (không chạy phần sửa bên dưới).
        return { ok: true };
      }

      // Chỉ Super Admin được sửa ngày tạo đơn.
      if (b.createdAt !== undefined && !isSuper) throw new ApiError(403, 'Chỉ Super Admin mới được sửa ngày tạo đơn.');
      // Mặc định giữ ngày tạo cũ.
      let safeCreatedAt: Date = row.created_at;
      // Có gửi ngày tạo mới → kiểm tra hợp lệ.
      if (b.createdAt !== undefined) {
        const rawDate = String(b.createdAt ?? '').trim();
        const parsed = new Date(rawDate);
        // Trống hoặc không đọc được thành ngày → báo lỗi 400.
        if (!rawDate || Number.isNaN(parsed.getTime())) throw new ApiError(400, 'Ngày tạo không hợp lệ.');
        safeCreatedAt = parsed;
      }

      // Thời điểm cập nhật.
      const now = new Date();
      // Hàm nhỏ `tv` (text value): trường chữ – có gửi lên thì lấy giá trị mới, không thì giữ giá trị cũ.
      const tv = (k: string, old: string) => (b[k] !== undefined ? txt(b[k]) : old);
      // Hàm nhỏ `nv` (number value): tương tự cho trường số.
      const nv = (k: string, old: number) => (b[k] !== undefined ? num(b[k]) : old);
      // `d` = bộ giá trị mới cho TẤT CẢ cột của dòng đơn (bên trái là tên cột trong DB).
      const d = {
        order_number: tv('orderNumber', row.order_number),
        item_code: tv('itemCode', row.item_code),
        packaging_code: tv('packagingCode', row.packaging_code),
        quantity: nv('quantity', row.quantity),
        // Có ảnh mới thì dùng ảnh mới, không thì giữ ảnh cũ.
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
        // Thời điểm hoàn thành:
        //  - chuyển sang 'completed' → giữ thời điểm cũ nếu có, không thì lấy bây giờ;
        //  - chuyển sang trạng thái khác → xóa (null);
        //  - không đổi trạng thái → giữ nguyên.
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
        // Lần đầu chuyển sang "đang chạy" → ghi tên người bấm chạy.
        if (b.status === 'running' && row.status !== 'running') d.runner_name = actor;
      } else if (!has(b, 'creatorName')) {
        // Kể cả Super Admin bấm chạy cũng không tự thay đổi chữ ký người tạo.
        d.creator_name = row.creator_name || '';
      }

      try {
        // Lấy danh sách tên cột trong `d` (`Object.keys` = danh sách tên trường của một đối tượng).
        const cols = Object.keys(d) as (keyof typeof d)[];
        // Tạo câu "UPDATE orders SET cot1 = ?, cot2 = ?, … WHERE id = ?" rồi truyền giá trị tương ứng + id đơn.
        await t.run(`UPDATE orders SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((c) => d[c]), row.id]);

        // Super Admin cập nhật trực tiếp dữ liệu gốc: không tạo audit/history cho các lần sửa tay.
        if (!isSuper) {
          // Ngày tạo thực sự bị đổi → ghi nhật ký kiểm toán (audit_logs) kèm giá trị trước/sau.
          if (b.createdAt !== undefined && safeCreatedAt.getTime() !== new Date(row.created_at).getTime()) {
            await t.run(
              `INSERT INTO audit_logs (action_type, target_id, order_number, details, actor, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              // `JSON.stringify` = đổi đối tượng thành chuỗi chữ để lưu vào cột details.
              ['EDIT_ORDER_CREATED_AT', row.id, row.order_number, JSON.stringify({ before: row.created_at, after: safeCreatedAt }), actor, u.id, now],
            );
          }
          // Trạng thái đổi → ghi lịch sử "Đổi trạng thái".
          if (b.status !== undefined && b.status !== row.status) {
            await addHistory(t, row as any, row.machine_name || '', actor, 'Đổi trạng thái', 0, 0, now);
          }
          // Tạm dừng / tiếp tục đổi → ghi lịch sử tương ứng.
          if (b.isPaused !== undefined && Boolean(b.isPaused) !== Boolean(row.is_paused)) {
            await addHistory(t, row as any, row.machine_name || '', actor, b.isPaused ? 'Tạm dừng máy' : 'Tiếp tục chạy máy', 0, 0, now);
          }
          // Đổi máy vận hành → ghi lịch sử "Chọn máy vận hành" (ghi tên máy mới).
          if (b.machineName !== undefined && String(b.machineName) !== String(row.machine_name || '')) {
            await addHistory(t, row as any, txt(b.machineName), actor, 'Chọn máy vận hành', 0, 0, now);
          }
          // Sửa số "Đã chạy" → ghi lịch sử kèm giá trị cũ và mới.
          if (b.runOnMachine !== undefined && Number(b.runOnMachine) !== Number(row.run_on_machine)) {
            await addHistory(t, row as any, row.machine_name || 'Chưa rõ máy', actor, 'Sửa Đã chạy', row.run_on_machine, b.runOnMachine, now);
          }
          // Sửa "Thực tế" → ghi lịch sử kèm giá trị cũ và mới.
          if (b.actualProduced !== undefined && Number(b.actualProduced) !== Number(row.actual_produced)) {
            await addHistory(t, row as any, row.machine_name || 'Chưa rõ máy', actor, 'Sửa Thực tế', row.actual_produced, b.actualProduced, now);
          }
        }
      } catch (e) {
        // Lỗi có mã sẵn thì trả nguyên; lỗi khác → "Lỗi cập nhật." (transaction tự hủy thay đổi).
        if (e instanceof ApiError) throw e;
        throw new ApiError(500, 'Lỗi cập nhật.');
      }
      // Thành công.
      return { ok: true };
    });
  }

  // ---------------------------------------------------------------------------------
  // Xóa đơn (admin)
  // ---------------------------------------------------------------------------------
  /**
   * DELETE /api/orders/:id – Xóa một dòng đơn.
   * - Ai gọi: chỉ admin / Super Admin (@RequireAdmin), từ nút Xóa ở trang Kế hoạch.
   * - Nhận: `:id` của dòng cần xóa.
   * - Trả về: { ok: true } (kể cả khi đơn không còn – coi như đã xóa).
   * - Điểm đặc biệt: nếu xóa ĐƠN GỐC mà vẫn còn dòng chạy thêm máy, dòng con sớm nhất được "đôn" lên làm đơn gốc mới,
   *   và dữ liệu kho gắn với đơn gốc cũ được chuyển sang đơn gốc mới để không bị mất.
   */
  @Delete(':id')
  @RequireAdmin()
  async remove(@Param('id') id: string) {
    // Thực hiện trong transaction để các bước chuyển dữ liệu + xóa xảy ra trọn vẹn.
    await this.db.tx(async (t) => {
      // Khóa cả nhóm đơn.
      const locked = await lockOrderGroup(t, id);
      // Không có đơn → không làm gì.
      if (!locked) return;
      const { row, group } = locked;
      // Xóa đơn gốc còn dòng chạy thêm: FK parent_order_id (ON DELETE SET NULL) sẽ tách các dòng con thành đơn riêng.
      // Giữ nhóm bằng cách đưa dòng con sớm nhất lên làm đơn gốc mới.
      // (`!row.parent_order_id` = dòng này không có cha → chính là đơn gốc.)
      if (!row.parent_order_id) {
        // Các dòng con = cả nhóm trừ dòng đang xóa; sắp xếp theo ngày tạo tăng dần, trùng ngày thì theo id.
        const children = group
          .filter((r) => r.id !== row.id)
          .sort((a, c) => new Date(a.created_at).getTime() - new Date(c.created_at).getTime() || String(a.id).localeCompare(String(c.id)));
        // Có dòng con:
        if (children.length) {
          // Dòng con sớm nhất trở thành đơn gốc mới.
          const newRoot = children[0];
          // Đơn gốc mới không còn cha.
          await t.run('UPDATE orders SET parent_order_id = NULL WHERE id = ?', [newRoot.id]);
          // Các dòng con còn lại chuyển sang trỏ về đơn gốc mới.
          await t.run('UPDATE orders SET parent_order_id = ? WHERE parent_order_id = ? AND id <> ?', [newRoot.id, row.id, newRoot.id]);
          // Khóa nhóm (group_id) đổi từ id cũ sang id gốc mới -> chuyển dữ liệu kho theo để không bị mồ côi.
          // Phiếu nhập sản lượng hằng ngày của kho.
          await t.run('UPDATE warehouse_daily_entries SET order_key = ? WHERE order_key = ?', [newRoot.id, row.id]);
          // Các dòng chốt kho cuối ngày.
          await t.run('UPDATE warehouse_daily_closing_lines SET order_key = ? WHERE order_key = ?', [newRoot.id, row.id]);
          // Số liệu sản lượng ban đầu (baseline): chỉ chuyển nếu đơn gốc mới CHƯA có baseline riêng (tránh trùng).
          await t.run(
            `UPDATE warehouse_production_baselines SET order_key = ? WHERE order_key = ?
               AND NOT EXISTS (SELECT 1 FROM warehouse_production_baselines WHERE order_key = ?)`,
            [newRoot.id, row.id, newRoot.id],
          );
        }
      }
      // Cuối cùng xóa dòng đơn.
      await t.run('DELETE FROM orders WHERE id = ?', [row.id]);
    });
    return { ok: true };
  }

  // ---------------------------------------------------------------------------------
  // Vận hành
  // ---------------------------------------------------------------------------------
  /**
   * POST /api/orders/:id/operations/start – Nút "Chạy" ở trang Vận hành: bắt đầu chạy đơn trên một máy.
   * - Quyền: vận hành ('vanhanh' / 'all' / Super Admin).
   * - Nhận (body): { machineName } – tên máy.
   * - Trả về: { ok: true }; mã 200.
   * - Lỗi: 403 thiếu quyền; 404 không có đơn; 400 đơn đã hoàn thành hoặc chưa chọn máy.
   */
  @Post(':id/operations/start')
  @HttpCode(200)
  async start(@Param('id') id: string, @Body() body: any, @CurrentUser() u: DbUser) {
    // Kiểm tra quyền vận hành.
    if (!operationPermission(u, 'operate')) throw new ApiError(403, 'Bạn chưa được cấp quyền vận hành máy.');
    return this.db.tx(async (t) => {
      // Khóa đúng dòng đơn này.
      const row = await lockOrder(t, id);
      if (!row) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
      // Đơn đã xong thì không chạy lại được.
      if (row.status === 'completed') throw new ApiError(400, 'Đơn đã hoàn thành.');
      // Tên máy (bỏ khoảng trắng thừa). `body?.machineName` = nếu body rỗng thì không báo lỗi mà trả undefined.
      const machine = String(body?.machineName || '').trim();
      if (!machine) throw new ApiError(400, 'Vui lòng chọn tên máy.');
      const now = new Date();
      // Cập nhật: trạng thái "đang chạy", bỏ tạm dừng, ghi tên máy và người chạy.
      await t.run(`UPDATE orders SET status = 'running', is_paused = false, machine_name = ?, runner_name = ?, updated_at = ? WHERE id = ?`, [
        machine, actorName(u), now, row.id,
      ]);
      // Ghi sự kiện vận hành và lịch sử thao tác "Bắt đầu chạy".
      await addOperationEvent(t, row as any, 'Bắt đầu chạy', machine, 0, 0, u, now);
      await addHistory(t, row as any, machine, actorName(u), 'Bắt đầu chạy', 0, 0, now);
      return { ok: true };
    });
  }

  /**
   * POST /api/orders/:id/operations/pause – Nút "Tạm dừng" ở trang Vận hành.
   * - Quyền: vận hành. Nhận: `:id`. Trả về: { ok: true }.
   * - Lỗi: 403 thiếu quyền; 404 không có đơn; 400 đơn đã hoàn thành.
   */
  @Post(':id/operations/pause')
  @HttpCode(200)
  async pause(@Param('id') id: string, @CurrentUser() u: DbUser) {
    // Kiểm tra quyền vận hành.
    if (!operationPermission(u, 'operate')) throw new ApiError(403, 'Bạn chưa được cấp quyền vận hành máy.');
    return this.db.tx(async (t) => {
      // Khóa dòng đơn.
      const row = await lockOrder(t, id);
      if (!row) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
      if (row.status === 'completed') throw new ApiError(400, 'Đơn đã hoàn thành.');
      // Tạm dừng chỉ đổi trạng thái; không yêu cầu và không ghi đè số máy/sản lượng.
      const now = new Date();
      // Bật cờ tạm dừng.
      await t.run('UPDATE orders SET is_paused = true, updated_at = ? WHERE id = ?', [now, row.id]);
      // Ghi sự kiện + lịch sử "Tạm dừng" với máy hiện tại.
      await addOperationEvent(t, row as any, 'Tạm dừng', row.machine_name, 0, 0, u, now);
      await addHistory(t, row as any, row.machine_name || '', actorName(u), 'Tạm dừng', 0, 0, now);
      return { ok: true };
    });
  }

  /**
   * POST /api/orders/:id/operations/resume – Nút "Chạy tiếp" ở trang Vận hành (sau khi tạm dừng).
   * - Quyền: vận hành. Nhận (body): { machineName } – có thể đổi sang máy khác khi chạy tiếp.
   * - Trả về: { ok: true }.
   * - Lỗi: 403 thiếu quyền; 404 không có đơn; 400 đơn không ở trạng thái tạm dừng / thiếu tên máy.
   */
  @Post(':id/operations/resume')
  @HttpCode(200)
  async resume(@Param('id') id: string, @Body() body: any, @CurrentUser() u: DbUser) {
    // Kiểm tra quyền vận hành.
    if (!operationPermission(u, 'operate')) throw new ApiError(403, 'Bạn chưa được cấp quyền vận hành máy.');
    return this.db.tx(async (t) => {
      // Khóa dòng đơn.
      const row = await lockOrder(t, id);
      if (!row) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
      // Chỉ chạy tiếp được khi đơn "đang chạy" nhưng đang tạm dừng.
      if (row.status !== 'running' || !row.is_paused) throw new ApiError(400, 'Chỉ được Chạy tiếp khi đơn hàng đang ở trạng thái Tạm dừng.');
      // Tên máy chạy tiếp.
      const machine = String(body?.machineName || '').trim();
      if (!machine) throw new ApiError(400, 'Vui lòng nhập tên máy tiếp tục chạy.');
      const now = new Date();
      // Bỏ tạm dừng, ghi máy và người chạy mới.
      await t.run(`UPDATE orders SET status = 'running', is_paused = false, machine_name = ?, runner_name = ?, updated_at = ? WHERE id = ?`, [
        machine, actorName(u), now, row.id,
      ]);
      // Ghi sự kiện + lịch sử "Chạy tiếp".
      await addOperationEvent(t, row as any, 'Chạy tiếp', machine, 0, 0, u, now);
      await addHistory(t, row as any, machine, actorName(u), 'Chạy tiếp', 0, 0, now);
      return { ok: true };
    });
  }

  /**
   * POST /api/orders/:id/operations/actual – API cũ để nhập sản lượng, NAY ĐÃ NGỪNG.
   * Luôn trả lỗi 410 ("đã ngừng hỗ trợ") kèm hướng dẫn: sản lượng nhập ở trang Kho.
   */
  @Post(':id/operations/actual')
  @HttpCode(200)
  actual() {
    throw new ApiError(410, 'Đã chuyển chức năng nhập sản lượng sang trang Kho. Trang Vận hành chỉ quản lý trạng thái và máy.');
  }

  /**
   * PUT /api/orders/:id/operations/complete – Nút "Xác nhận hoàn thành" ở trang Vận hành.
   * - Quyền: xác nhận ('xacnhan' / 'all' / Super Admin).
   * - Khác với PUT /:id/complete: KHÔNG kiểm tra đủ sản lượng; đánh dấu hoàn thành cho cả nhóm đơn.
   * - Trả về: { ok: true }. Lỗi: 403 thiếu quyền; 404 không có đơn.
   */
  @Put(':id/operations/complete')
  async operationsComplete(@Param('id') id: string, @CurrentUser() u: DbUser) {
    // Kiểm tra quyền xác nhận.
    if (!operationPermission(u, 'confirm')) throw new ApiError(403, 'Bạn chưa được cấp quyền xác nhận hoàn thành.');
    return this.db.tx(async (t) => {
      // Khóa cả nhóm đơn.
      const locked = await lockOrderGroup(t, id);
      if (!locked) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
      const { row } = locked;
      // Xác nhận hoàn thành không yêu cầu nhập sản lượng và không tự sửa số liệu sản xuất.
      const now = new Date();
      const actor = actorName(u);
      // Mọi dòng cùng nhóm: hoàn thành, bỏ tạm dừng, ghi người xác nhận và thời điểm.
      await t.run(`UPDATE orders SET status = 'completed', completed_at = ?, is_paused = false, confirmer_name = ?, updated_at = ? WHERE group_id = ?`, [
        now, actor, now, row.group_id,
      ]);
      // Ghi sự kiện + lịch sử "Xác nhận hoàn thành".
      await addOperationEvent(t, row as any, 'Xác nhận hoàn thành', row.machine_name, 0, 0, u, now);
      await addHistory(t, row as any, '', actor, 'Xác nhận hoàn thành', 0, 0, now);
      return { ok: true };
    });
  }

  /**
   * GET /api/orders/:id/operations – Danh sách sự kiện vận hành (bắt đầu, tạm dừng, chạy thêm máy…) của cả nhóm đơn.
   * - Ai gọi: mọi người đã đăng nhập (khung "dòng thời gian vận hành" trong chi tiết đơn ở trang Kế hoạch).
   * - Trả về: mảng dòng order_events, cũ trước mới sau. Lỗi: 404 không có đơn.
   */
  @Get(':id/operations')
  async operations(@Param('id') id: string) {
    // Tìm mã nhóm của đơn.
    const row = await this.db.get<{ group_id: string }>('SELECT group_id FROM orders WHERE id = ?', [id]);
    if (!row) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
    // Lấy mọi sự kiện của các dòng thuộc nhóm (nối order_events với orders), sắp theo thời gian rồi theo id.
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
  /**
   * POST /api/orders/:id/split – Nút "Chạy thêm máy": cùng một đơn chạy song song trên máy khác.
   * Ví dụ đơn 100 tấn đang chạy máy 1, bấm chạy thêm máy 2 → tạo 1 dòng con (sao chép thông tin đơn gốc),
   * trạng thái 'running', đã chạy = 0, thực tế = 0.
   * - Quyền: vận hành. Nhận (body): { machineName } – tên máy mới.
   * - Trả về: { ok: true }.
   * - Lỗi: 403 thiếu quyền; 404 không có đơn; 400 đơn chưa chạy / đang tạm dừng, thiếu tên máy; 500 lỗi tạo dòng.
   */
  @Post(':id/split')
  @HttpCode(200)
  async split(@Param('id') id: string, @Body() body: any, @CurrentUser() u: DbUser) {
    // Kiểm tra quyền vận hành.
    const perms = orderPerms(u);
    if (!u.isSuper && !perms.includes('vanhanh') && !perms.includes('all')) throw new ApiError(403, 'Bạn chưa được cấp quyền vận hành máy.');
    return this.db.tx(async (t) => {
      // Khóa cả nhóm đơn.
      const locked = await lockOrderGroup(t, id);
      if (!locked) throw new ApiError(404, 'Không tìm thấy đơn hàng gốc.');
      const { row, group } = locked;
      // Nhóm có ít nhất 1 dòng đang chạy và không tạm dừng?
      const groupIsRunning = group.some((x: Row) => x.status === 'running' && !x.is_paused);
      // Không → không cho chạy thêm máy.
      if (!groupIsRunning) {
        throw new ApiError(400, 'Chỉ được chạy thêm máy khi đơn hàng đang chạy (màu xanh dương). Hãy bấm Chạy tiếp trước nếu đơn đang tạm dừng.');
      }
      // Tên máy mới.
      const machineName = String(body?.machineName || '').trim();
      if (!machineName) throw new ApiError(400, 'Vui lòng nhập tên máy mới.');
      try {
        // Mã cho dòng mới và thời điểm hiện tại.
        const newId = newOrderId(4);
        const now = new Date();
        // Chèn dòng con: parent_order_id trỏ về đơn gốc; sao chép thông số đơn; đã chạy = 0, thực tế = 0,
        // trạng thái 'running', máy mới, người tạo dòng = người bấm.
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
        // Ghi lịch sử thao tác cho dòng mới.
        await addHistory(t, { id: newId, order_number: row.order_number }, machineName, actorName(u), 'Chạy thêm máy', 0, 0, now);
      } catch {
        // Lỗi DB → báo lỗi (transaction tự hủy).
        throw new ApiError(500, 'Lỗi khi tạo dòng chạy thêm.');
      }
      return { ok: true };
    });
  }

  // ---------------------------------------------------------------------------------
  // Xác nhận hoàn thành (kiểm tra đủ sản lượng)
  // ---------------------------------------------------------------------------------
  /**
   * PUT /api/orders/:id/complete – Xác nhận hoàn thành đơn, BẮT BUỘC tổng sản lượng thực tế ≥ số lượng đơn.
   * - Quyền: xác nhận ('xacnhan' / 'all' / Super Admin).
   * - Trả về: { ok: true }.
   * - Lỗi: 404 không có đơn; 403 thiếu quyền; 400 "Chưa đủ sản lượng: 80/100 tấn."
   */
  @Put(':id/complete')
  async complete(@Param('id') id: string, @CurrentUser() u: DbUser) {
    return this.db.tx(async (t) => {
      // Khóa cả nhóm đơn.
      const locked = await lockOrderGroup(t, id);
      if (!locked) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
      // Kiểm tra quyền xác nhận.
      const perms = orderPerms(u);
      if (!u.isSuper && !perms.includes('xacnhan') && !perms.includes('all')) throw new ApiError(403, 'Bạn chưa được cấp quyền xác nhận hoàn thành.');
      const { row, group } = locked;
      // Số lượng yêu cầu = số lớn nhất trong nhóm (`Math.max(...mảng)` = giá trị lớn nhất).
      const qty = Math.max(...group.map((x: Row) => Number(x.quantity) || 0));
      // Tổng sản lượng thực tế mọi máy. `reduce` = duyệt mảng và cộng dồn vào `sum` (bắt đầu từ 0).
      const produced = group.reduce((sum: number, x: Row) => sum + (Number(x.actual_produced) || 0), 0);
      // Chưa đủ → báo lỗi.
      if (produced < qty) throw new ApiError(400, `Chưa đủ sản lượng: ${produced}/${qty} tấn.`);
      const now = new Date();
      const actor = actorName(u);
      // Đánh dấu hoàn thành cho cả nhóm.
      await t.run(`UPDATE orders SET status = 'completed', completed_at = ?, is_paused = false, updated_at = ?, confirmer_name = ? WHERE group_id = ?`, [
        now, now, actor, row.group_id,
      ]);
      // Ghi lịch sử (giá trị cũ = sản lượng thực tế, giá trị mới = số lượng yêu cầu).
      await addHistory(t, row as any, 'Tất cả máy', actor, 'Xác nhận hoàn thành đơn', produced, qty, now);
      return { ok: true };
    });
  }
}
