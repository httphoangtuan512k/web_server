# Hướng dẫn port `web/` → `web_server/`

Đọc kèm `docs/MIGRATION_PLAN.md`. Mã nguồn cũ (chỉ đọc, **không sửa**): `/Users/nvt/CODE/CV/CODE TUẤN/web/`
(`server.js`, `excel-manager.js`, `*.html`, `pages/*.html`).

## 0. Quy tắc làm việc chung

- Chỉ sửa file trong phạm vi được giao. **Không sửa** các file dùng chung:
  `server/src/{db,auth,blob,common}/**`, `server/src/app.module.ts`, `server/src/db/schema.ts`, `server/db/**`,
  `{lib,components/ui,components/shell}/**`, `app/layout.tsx`, `app/globals.css`, `package.json`, lockfile.
  Cần đổi schema / thêm thư viện / sửa file dùng chung → **ghi vào báo cáo cuối** (lý do + đề xuất cụ thể), tạm thời xoay sở trong phạm vi của mình.
- Không `npm install`. Thư viện có sẵn — API: `@nestjs/*`, `drizzle-orm`, `pg`, `exceljs`, `bcryptjs`, `@vercel/blob`. Web: `next@16`, `react@19`, `lucide-react`, `clsx`, `@vercel/blob`, Tailwind v4.
- Không `git commit`/`push` (người điều phối sẽ làm).
- Toàn bộ chữ trên giao diện và thông báo lỗi: **tiếng Việt có dấu**.

## 1. Chạy & kiểm tra

```bash
# Ứng dụng duy nhất ở thư mục gốc – .env.local trỏ DB local "superwhite_dev" (bản sao dữ liệu thật, thoải mái thử)
npm run typecheck && npm run lint
npm run dev                                # http://localhost:3000 (web + API)
# tài khoản test: dev_admin / DevAdmin#2026 (Super Admin)
curl -c /tmp/ck -H 'content-type: application/json' -d '{"username":"dev_admin","password":"DevAdmin#2026"}' localhost:3000/api/login
curl -b /tmp/ck localhost:3000/api/orders
psql -d superwhite_dev                      # xem dữ liệu

```

`.env.neon` chứa thông tin Neon thật – chỉ dùng khi cố ý thao tác trên production.

## 2. Backend (NestJS 11 + Drizzle) – quy ước

Mỗi phân hệ nằm trong `server/src/modules/<tên>/` và đã được import vào `AppModule`. Khai báo controller/service trong `<tên>.module.ts` của mình.

```ts
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DbService, schema } from '../../db/db.service';
import { ApiError } from '../../common/api-error';
import { CurrentUser, Public, RequireAdmin, RequirePage, RequireSuper } from '../../auth/decorators';
import { DbUser, displayName, hasOrderPermission, hasPage, isAdminUser } from '../../auth/auth.types';
import { BlobService } from '../../blob/blob.service';
import { vnDateKey, vnDateTime, vnParts, vnStartOfDay } from '../../common/time';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly db: DbService, private readonly blob: BlobService) {}

  @Get()
  @RequirePage('kehoach')
  async list(@CurrentUser() user: DbUser) {
    return this.db.orm.select().from(schema.orders).orderBy(desc(schema.orders.createdAt));
  }

  @Post(':id/pause')
  @HttpCode(200)                 // ⚠ Nest mặc định POST = 201; server cũ trả 200 trừ khi gọi res.status(201)
  async pause(@Param('id') id: string, @CurrentUser() user: DbUser) {
    return this.db.tx(async (t) => {          // = db.transaction() cũ; bên trong CHỈ dùng `t`
      const [o] = await t.orm.select().from(schema.orders).where(eq(schema.orders.id, id)).for('update');
      if (!o) throw new ApiError(404, 'Không tìm thấy đơn hàng.');
      // SQL thuần khi cần: await t.all('SELECT … WHERE group_id = ?', [o.groupId]);
      return { ok: true };
    });
  }
}
```

- **Guard toàn cục**: mọi route cần đăng nhập, trừ `@Public()`. `@RequireAdmin()` = requireAdmin, `@RequireSuper()` = requireSuperAdmin, `@RequirePage('kho')` = requirePageAccess.
  Middleware riêng (requireWarehouseEdit, requireMaintenanceAccess, requirePlcOperator, …) → viết hàm kiểm tra trong service rồi `throw new ApiError(403, '<đúng câu thông báo cũ>')`.
- `@CurrentUser()` trả `DbUser` (camelCase, kiểu Drizzle `users.$inferSelect`) – tương đương `getUser(req.session.user.id)` cũ.
- Lỗi: `throw new ApiError(status, 'Thông báo')` → `{ "error": "Thông báo" }` giống hệt server cũ. Giữ **nguyên câu thông báo và mã HTTP** của server cũ.
- Tải file (Excel): dùng `@Res() res: Response` của express, set `Content-Type` + `Content-Disposition` (dùng `filename*=UTF-8''…`) rồi `res.send(buffer)`.
- `db.orm` (Drizzle, có kiểu) cho CRUD; `db.all/get/run(sql, params)` cho SQL thuần (placeholder `?` được tự đổi sang `$n`).
  SQL thuần trả về cột **snake_case**, kiểu: timestamptz → `Date`, date → chuỗi `'YYYY-MM-DD'`, boolean → boolean, COUNT/SUM → number.
- Khác biệt Postgres so với SQLite cần nhớ: `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`; `MAX(a,b)` → `GREATEST`; `IFNULL` → `COALESCE`; `group_concat` → `string_agg`;
  `LIKE` phân biệt hoa thường → dùng `ILIKE`; GROUP BY phải liệt kê đủ cột không gộp; NULL sắp xếp cuối khi ASC; `lastInsertRowid` → `.returning()`;
  `julianday/datetime/strftime` → phép toán timestamptz (`now() - interval '1 minute'`). Không ghép chuỗi người dùng vào SQL – luôn dùng tham số.
- **Giờ Việt Nam**: Vercel chạy UTC. Mọi "ngày làm việc", tên file theo ngày, lọc theo ngày… dùng `vnDateKey()`, `vnParts()`, `vnStartOfDay()` trong `common/time.ts`,
  **không** dùng `getDate()/getHours()/toLocaleDateString()` thiếu `timeZone`.
- **Không có trạng thái trong RAM** giữa các request (serverless): mọi Map/biến toàn cục của server cũ phải chuyển vào DB (`plc_devices`, `plc_machine_states`, `app_settings`).
- **Ảnh**: trường JSON giữ tên cũ (`imageData`, `faultImage`, `afterImage`, `avatar`). Giá trị nhận vào có thể là `'/api/files/…'` (frontend đã upload) hoặc data-URL (tương thích cũ)
  → luôn qua `await this.blob.persistImage(value, 'orders'|'maintenance'|'avatars')` trước khi lưu. **Không xóa** blob ảnh cũ khi sửa/xóa (ảnh có thể dùng chung giữa đơn tách).
- File khác (tài liệu, backup, xuất Excel bảo trì): `BlobService.put/get/readBuffer/list/delete` (store **private**; không có URL công khai, phải phục vụ qua API).

### 2.1 Hợp đồng API (frontend dựa vào đây)

- **Giữ nguyên đường dẫn, phương thức, tham số, tên khóa JSON và mã HTTP** của từng route trong `server.js`/`excel-manager.js`.
  Route nào trước đây trả về dòng DB thô (`SELECT *`, khóa snake_case như `order_number`, `created_at`) thì vẫn trả **đúng các khóa snake_case cũ**
  (ánh xạ từ cột mới – xem bảng §4). Thời gian trả về chuỗi ISO (Date tự serialize). Cờ 0/1 có thể trả boolean.
- Thay đổi/bổ sung đã chốt:
  - `POST /api/login` → `{ ok, redirect: '/', user }`.
  - `GET /api/me`, `GET /api/users`: thêm `orderPermissions` (= quyền đơn). `/api/users` vẫn giữ khóa `permissions` (mảng quyền đơn, như cũ).
  - `GET /api/files/<pathname>`: ảnh (cần đăng nhập). `POST /api/uploads/token`: cấp token upload Blob (dùng `uploadFile()` ở web).
  - `GET /api/health` (public).
  - **Nhật ký** (thay cho `/api/logs/:yy/:m/:d` vốn không tồn tại ở server cũ):
    `GET /api/logs?date=YYYY-MM-DD` (admin) → `{ date, items: LogItem[] }` sắp xếp mới nhất trước, với
    `LogItem = { id: string; source: 'history'|'event'|'audit'; time: string; actor: string; action: string; orderNumber: string; machineName: string; detail: string; oldValue: number|null; newValue: number|null }`
    (`id` dạng `'history-12'`; `detail` là mô tả ngắn tiếng Việt; lọc theo ngày giờ VN).
  - **Tài liệu** (`/api/tai-lieu/*`): giữ mọi route cũ, riêng upload đổi sang 2 bước vì Vercel giới hạn body 4,5 MB:
    1) web gọi `uploadFile(file, 'documents')` → `{ pathname, size, contentType }`;
    2) `POST /api/tai-lieu/upload` JSON `{ pathname, originalName, size, contentType }` → như cũ (`201` + bản ghi).
    Cập nhật phiên bản: `POST /api/tai-lieu/:id/update` JSON `{ pathname, originalName, size, contentType, lockToken? }`.
    Tải về: `GET /api/tai-lieu/:id/download` stream từ Blob (kiểm tra quyền như cũ).
  - **Sao lưu**: `GET /api/superadmin/backups` (danh sách bản sao lưu trên Blob), `POST /api/superadmin/backups` (tạo ngay),
    `GET /api/superadmin/backups/download?path=<pathname>` (tải về), `GET /api/cron/daily-backup` (`@Public`, kiểm tra header `Authorization: Bearer ${CRON_SECRET}`).
  - **Super data**: giữ 4 route cũ (`/api/super-data/tables`, `GET/PATCH/DELETE /api/super-data/:table`) và cùng dạng JSON, áp dụng cho các bảng mới (§4).

## 3. Frontend (Next.js 16 + Tailwind v4) – quy ước

- Đây là bản **thiết kế lại** (chuyên nghiệp, gọn, responsive cho cả điện thoại/tablet ở xưởng) nhưng **giữ đủ 100% chức năng** của trang cũ.
  Trước khi viết, đọc kỹ file HTML cũ và liệt kê mọi chức năng (nút, bộ lọc, cột bảng, modal, quyền, in/xuất Excel, tự làm mới…) – tất cả phải có mặt.
- Mỗi trang: `app/(app)/<route>/page.tsx` (server component mỏng, chỉ khai báo `metadata` và render 1 client component) +
  các component riêng trong `app/(app)/<route>/_components/*.tsx` (`"use client"`). Có thể chia nhiều file; không dồn 1 file khổng lồ.
- Next 16 bật `cacheComponents`: **không** dùng `new Date()`/`Math.random()`/fetch ở server component; mọi dữ liệu lấy ở client component bằng `api` (`@/lib/api`).
  Đọc `node_modules/next/dist/docs/` nếu dùng API Next lạ.
- Dùng sẵn (không tự viết lại):
  - `@/lib/api` – `api.get/post/put/patch/delete/download`, `errorMessage(e)`; 401 tự về /login.
  - `@/lib/auth` – `useAuth()` → `{ me, isAdmin, can(page), canOrder(perm), refresh, logout }`.
  - `@/lib/format` – `fmtDate, fmtDateTime, fmtTime, fmtNumber, fmtRelative, fmtBytes, todayKey` (giờ VN).
  - `@/lib/upload` – `uploadImage(file, folder)` → `'/api/files/…'`; `uploadFile(file, 'documents')`.
  - `@/components/shell/page-guard` – `<PageGuard page="kho">` / `<PageGuard role="admin|super">` bọc toàn trang.
  - `@/components/ui/*` – `Button` (variant primary|secondary|ghost|danger|accent|success, size sm|md|lg|icon, `icon={LucideIcon}`, `loading`),
    `Field, Input, Select, Textarea, Checkbox, SearchInput`, `Card, CardHeader, CardBody, PageHeader, Badge (tone), StatCard, EmptyState, Spinner, Skeleton`,
    `Modal (size sm|md|lg|xl|full, footer)`, `useConfirm()`, `useToast()`, `Table, THead, Th, Tr, Td (align="right" cho số)`, `Tabs`, `ImageInput`.
- Màu/token Tailwind: `bg-bg, bg-surface, bg-surface-2/3, text-fg, text-muted, text-subtle, border-line, border-line-strong`,
  `brand-50…900` (xanh thương hiệu), `accent-50…700` (cam), `success|warning|danger|info-50/600/700`. Có dark mode – **không** hard-code màu hex/`bg-white`/`text-gray-*`.
  Số liệu dùng class `num` (tabular). Icon: `lucide-react`.
- Bố cục gợi ý: `PageHeader` (tiêu đề + nút chính) → hàng `StatCard` tóm tắt (nếu có số liệu) → bộ lọc → `Card` chứa `Table`/danh sách. Trên mobile bảng cuộn ngang
  hoặc đổi sang dạng thẻ. Form dài đặt trong `Modal` hoặc trang chi tiết. Thao tác nguy hiểm dùng `useConfirm({ danger: true })`. Thành công/thất bại báo bằng `useToast()`.
- Ảnh: hiển thị `<img src={url}>` trực tiếp (URL `/api/files/...` cùng domain, có cookie). Chọn ảnh mới dùng `ImageInput`.
- Tự làm mới định kỳ (nếu trang cũ có): `setInterval` trong `useEffect` + dọn dẹp, dừng khi tab ẩn (`document.visibilityState`).

## 4. Ánh xạ schema cũ → mới (`server/src/db/schema.ts`)

| Cũ (SQLite) | Mới (Postgres) | Ghi chú |
|---|---|---|
| `users.active` (0/1) | `users.is_active` (bool) | |
| `users.is_super` (0/1) | `users.is_super` (bool) | |
| `users.avatar` | `users.avatar_url` | JSON vẫn là `avatar` |
| `users.page_permissions` (JSON text) | `users.page_permissions` (`text[]`) | giá trị: kehoach, vanhanh, kcs, xuathang, kho, **kho_edit**, baotri |
| bảng `order_status_permissions` | `users.order_permissions` (`text[]`) | giá trị: `new`, `edit`, `vanhanh`, `xacnhan` (+ `all` nếu code cũ kiểm tra) |
| `login_sessions` | `user_sessions` | `logout_at` NULL = chưa đăng xuất (cũ là `''`); `user_id` NULL nếu user đã xóa |
| `orders.image_data` | `orders.image_url` | JSON vẫn là `imageData` |
| `orders.parent_order_id` (`''` = gốc) | `orders.parent_order_id` (NULL = gốc) | + cột sinh `orders.group_id` = `COALESCE(parent_order_id, id)` (thay mọi `COALESCE(NULLIF(parent_order_id,''),id)`) |
| `orders.is_paused` (0/1) | bool | |
| `orders.completed_at` (`''`) | timestamptz NULL | |
| `history_logs` | `order_history` | các cột giữ tên |
| `operation_events` | `order_events` | |
| `audit_logs.details` (text) | `audit_logs.details` (jsonb) | + `actor_id`; `target_id` là text |
| `maintenance_records.fault_image / after_image` | `fault_image_url / after_image_url` | + `created_by_id`; `updated_at` NULL nếu chưa sửa |
| `warehouse_goods / warehouse_packaging / warehouse_materials` | `warehouse_items` (`category` = goods/packaging/materials) | cột chung: code, name, grain_size, lot_number, shelf_number, unit, quantity |
| `warehouse_transactions.item_id` | FK → `warehouse_items.id` | |
| `warehouse_daily_*.work_date` (text) | `date` (chuỗi 'YYYY-MM-DD') | |
| `warehouse_daily_lines` | `warehouse_daily_closing_lines` | |
| `warehouse_daily_snapshots.snapshot_json` (text) | `snapshot` (jsonb) | `UNIQUE(work_date, version)` |
| `warehouse_order_production_baseline` | `warehouse_production_baselines` | |
| `plc_api_keys` + RAM `plcLatestCache/plcLastHistoryAt/plcLastTelemetryAt` | `plc_devices` (api_key_*, last_payload, last_received_at, last_history_at) | |
| `plc_operation_state.state_json` | `plc_machine_states.state` (jsonb) | |
| `plc_telemetry_history.payload_json` | `payload` (jsonb) | |
| `excel_files / excel_permissions / excel_edit_locks / excel_activity_logs` | `documents / document_permissions / document_locks / document_activity_logs` | `stored_name` → `blob_pathname`; `file_id` → `document_id`; `owner_user_id` → `owner_id` |
| — | `app_settings` (key/value jsonb) | cấu hình không cần migration |
| `warehouse_production_*` (đời cũ, không dùng) | `legacy_records` | chỉ lưu trữ |

Mọi bảng có `updated_at` được trigger tự cập nhật khi UPDATE.
