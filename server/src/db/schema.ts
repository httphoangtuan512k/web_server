/**
 * File này: bản thiết kế mọi bảng của DB (Postgres/Neon) viết bằng Drizzle ORM – SUPER WHITE.
 * Dùng ở: db.service.ts (truy vấn có kiểu), drizzle.config.ts (sinh migration), các script.
 *
 * Đây là NGUỒN DUY NHẤT của cấu trúc DB. Quy trình nâng cấp:
 *   1. Sửa file này
 *   2. `npm run db:generate -- --name <mo_ta>`  → sinh file SQL trong db/migrations (review trước khi commit)
 *   3. `npm run db:migrate`                     → áp dụng lên DB (chỉ chạy migration chưa áp dụng)
 *
 * Quy ước:
 *   - Tên bảng/cột snake_case, số nhiều cho bảng; khóa chính `id`.
 *   - Thời điểm: timestamptz (`*_at`); ngày làm việc: date (`work_date`, chuỗi 'YYYY-MM-DD').
 *   - Cờ: boolean (`is_*`); danh sách quyền: text[]; dữ liệu mềm: jsonb.
 *   - Số lượng (tấn, bao…): double precision.
 *   - Ảnh/tài liệu: Vercel Blob (private); cột `*_url` lưu '/api/files/<pathname>', cột `blob_pathname` lưu pathname.
 *   - Tên người thao tác được lưu kèm (`*_name`) để lịch sử không đổi khi tài khoản bị sửa/xóa.
 */
import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// Cột thời điểm có múi giờ (timestamptz).
const tz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
// Cột created_at: tự điền lúc tạo dòng.
const createdAt = () => tz('created_at').notNull().defaultNow();
// Cột updated_at: tự cập nhật mỗi lần sửa dòng.
const updatedAt = () =>
  tz('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
// Cột số lượng (số thực), mặc định 0.
const qty = (name: string) => doublePrecision(name).notNull().default(0);
// Khóa chính id: số nguyên tự tăng.
const id = () => integer('id').primaryKey().generatedByDefaultAsIdentity();

/** Quyền trang: kehoach, vanhanh, kcs, xuathang, kho, kho_edit, baotri. */
export const PAGE_PERMISSIONS = ['kehoach', 'vanhanh', 'kcs', 'xuathang', 'kho', 'kho_edit', 'baotri'] as const;
/** Quyền thao tác đơn hàng: new (tạo), edit (sửa), vanhanh (chạy), xacnhan (xác nhận hoàn thành). */
export const ORDER_PERMISSIONS = ['new', 'edit', 'vanhanh', 'xacnhan'] as const;
/** Trạng thái đơn: mới / đang chạy / hoàn thành. */
export const ORDER_STATUSES = ['new', 'running', 'completed'] as const;
/** Nhóm hàng trong kho: thành phẩm / bao bì / vật tư. */
export const WAREHOUSE_CATEGORIES = ['goods', 'packaging', 'materials'] as const;

// =====================================================================================
// NGƯỜI DÙNG & PHIÊN
// =====================================================================================
/** Tài khoản người dùng. */
export const users = pgTable(
  'users',
  {
    id: id(),
    username: text('username').notNull().unique(),
    // Mật khẩu đã băm bằng bcrypt (không lưu mật khẩu gốc).
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull().default(''),
    position: text('position').notNull().default(''),
    avatarUrl: text('avatar_url').notNull().default(''),
    role: text('role').notNull().default('user'), // 'user' | 'admin'
    isSuper: boolean('is_super').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    // Danh sách quyền trang / quyền đơn hàng (mảng chữ).
    pagePermissions: text('page_permissions').array().notNull().default(sql`'{}'::text[]`),
    orderPermissions: text('order_permissions').array().notNull().default(sql`'{}'::text[]`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // Ràng buộc: role chỉ được là 'user' hoặc 'admin'.
  (t) => [check('users_role_check', sql`${t.role} IN ('user','admin')`)],
);

/** Phiên đăng nhập (cookie chứa sid, DB lưu sha256(sid)). Giữ lại khi xóa user để Super Admin xem lịch sử. */
export const userSessions = pgTable(
  'user_sessions',
  {
    id: id(),
    // sha256 của mã phiên trong cookie.
    sessionKey: text('session_key').notNull().unique(),
    // Xóa user thì để trống user_id, vẫn giữ phiên.
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    username: text('username').notNull(),
    fullName: text('full_name').notNull().default(''),
    role: text('role').notNull().default('user'),
    isSuper: boolean('is_super').notNull().default(false),
    // Giờ đăng nhập, lần hoạt động cuối, giờ đăng xuất (null = còn mở).
    loginAt: tz('login_at').notNull().defaultNow(),
    lastSeenAt: tz('last_seen_at').notNull().defaultNow(),
    logoutAt: tz('logout_at'),
    ipAddress: text('ip_address').notNull().default(''),
    userAgent: text('user_agent').notNull().default(''),
  },
  // Chỉ mục (index) giúp tìm phiên nhanh theo người/thời gian.
  (t) => [index('user_sessions_user_login_idx').on(t.userId, t.loginAt.desc()), index('user_sessions_login_idx').on(t.loginAt.desc())],
);

// =====================================================================================
// ĐƠN HÀNG (KẾ HOẠCH / VẬN HÀNH)
// =====================================================================================
/** Đơn hàng sản xuất (kế hoạch → vận hành → hoàn thành). */
export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(), // 'order_<ms>_<hex>'
    /** Đơn gốc khi chạy thêm máy / tách đơn; NULL = chính nó là đơn gốc. */
    parentOrderId: text('parent_order_id').references((): AnyPgColumn => orders.id, { onDelete: 'set null' }),
    /** Khóa nhóm = COALESCE(parent_order_id, id) – dùng cho kho, tổng sản lượng (cột sinh tự động). */
    groupId: text('group_id')
      .notNull()
      .generatedAlwaysAs(sql`COALESCE(parent_order_id, id)`),
    // Thông tin đơn: số đơn, mã hàng, bao bì, số lượng (tấn), ảnh, chỉ tiêu kỹ thuật…
    orderNumber: text('order_number').notNull(),
    itemCode: text('item_code').notNull().default(''),
    packagingCode: text('packaging_code').notNull().default(''),
    quantity: qty('quantity'),
    imageUrl: text('image_url').notNull().default(''),
    whiteness: text('whiteness').notNull().default(''),
    grainSize: text('grain_size').notNull().default(''),
    bagWeight: text('bag_weight').notNull().default(''),
    coatingRate: text('coating_rate').notNull().default(''),
    stoneType: text('stone_type').notNull().default(''),
    impurity: text('impurity').notNull().default(''),
    pallet: text('pallet').notNull().default(''),
    extraBag: text('extra_bag').notNull().default(''),
    orderCommand: text('order_command').notNull().default(''),
    // Máy chạy; sản lượng chạy trên máy / thực tế / kho bù.
    machineName: text('machine_name').notNull().default(''),
    runOnMachine: qty('run_on_machine'),
    actualProduced: qty('actual_produced'),
    khoBu: qty('kho_bu'),
    // Trạng thái và cờ tạm dừng.
    status: text('status').notNull().default('new'),
    isPaused: boolean('is_paused').notNull().default(false),
    exportDate: text('export_date').notNull().default(''),
    // Tên người tạo / chạy / xác nhận / kho (lưu cứng để lịch sử không đổi).
    creatorName: text('creator_name').notNull().default(''),
    runnerName: text('runner_name').notNull().default(''),
    confirmerName: text('confirmer_name').notNull().default(''),
    khoName: text('kho_name').notNull().default(''),
    // Id người tạo/sửa; xóa user thì để trống.
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    completedAt: tz('completed_at'),
  },
  // Ràng buộc trạng thái hợp lệ + chỉ mục tìm nhanh.
  (t) => [
    check('orders_status_check', sql`${t.status} IN ('new','running','completed')`),
    index('orders_group_idx').on(t.groupId),
    index('orders_status_idx').on(t.status),
    index('orders_number_idx').on(t.orderNumber),
    index('orders_created_idx').on(t.createdAt.desc()),
  ],
);

/** Lịch sử thay đổi sản lượng/đơn (history_logs cũ). Không FK để vẫn giữ khi xóa đơn. */
export const orderHistory = pgTable(
  'order_history',
  {
    id: id(),
    orderId: text('order_id').notNull(),
    orderNumber: text('order_number').notNull(),
    machineName: text('machine_name').notNull().default(''),
    userName: text('user_name').notNull(),
    action: text('action').notNull(),
    // Giá trị trước và sau khi thay đổi.
    oldValue: doublePrecision('old_value').default(0),
    newValue: doublePrecision('new_value').default(0),
    createdAt: createdAt(),
  },
  (t) => [index('order_history_created_idx').on(t.createdAt.desc()), index('order_history_order_idx').on(t.orderId)],
);

/** Sự kiện vận hành: Bắt đầu chạy / Tạm dừng / Chạy tiếp / Chạy thêm máy / Xác nhận hoàn thành. */
export const orderEvents = pgTable(
  'order_events',
  {
    id: id(),
    orderId: text('order_id').notNull(),
    orderNumber: text('order_number').notNull(),
    eventType: text('event_type').notNull(),
    machineName: text('machine_name').notNull().default(''),
    machineCount: doublePrecision('machine_count').notNull().default(0),
    actualTons: doublePrecision('actual_tons').notNull().default(0),
    userName: text('user_name').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('order_events_order_idx').on(t.orderId, t.createdAt)],
);

/** Nhật ký kiểm toán dùng chung (EDIT_HISTORY, DELETE_HISTORY, CLOSE_WAREHOUSE_DAILY, …). */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    actionType: text('action_type').notNull(),
    targetId: text('target_id'),
    orderNumber: text('order_number').notNull().default(''),
    // Chi tiết thay đổi dạng JSON.
    details: jsonb('details'),
    actor: text('actor').notNull(),
    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('audit_logs_created_idx').on(t.createdAt.desc()), index('audit_logs_action_idx').on(t.actionType)],
);

// =====================================================================================
// BẢO TRÌ
// =====================================================================================
/** Phiếu bảo trì: thiết bị, mô tả lỗi, ảnh trước/sau, nội dung sửa. */
export const maintenanceRecords = pgTable(
  'maintenance_records',
  {
    id: id(),
    equipment: text('equipment').notNull(),
    faultDescription: text('fault_description').notNull(),
    faultImageUrl: text('fault_image_url').notNull().default(''),
    repairContent: text('repair_content').notNull().default(''),
    afterStatus: text('after_status').notNull().default(''),
    afterImageUrl: text('after_image_url').notNull().default(''),
    createdBy: text('created_by').notNull(),
    createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: tz('updated_at'),
  },
  (t) => [index('maintenance_created_idx').on(t.createdAt.desc())],
);

// =====================================================================================
// KHO
// =====================================================================================
/** Gộp warehouse_goods / warehouse_packaging / warehouse_materials cũ thành 1 bảng theo `category`. */
export const warehouseItems = pgTable(
  'warehouse_items',
  {
    id: id(),
    category: text('category').notNull(), // goods | packaging | materials
    code: text('code').notNull().default(''), // goods
    name: text('name').notNull(),
    grainSize: text('grain_size').notNull().default(''), // goods
    lotNumber: text('lot_number').notNull().default(''), // packaging
    shelfNumber: text('shelf_number').notNull().default(''), // materials
    unit: text('unit').notNull().default(''),
    quantity: qty('quantity'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('warehouse_items_category_check', sql`${t.category} IN ('goods','packaging','materials')`),
    index('warehouse_items_category_idx').on(t.category, t.name),
  ],
);

/** Lịch sử nhập/xuất kho. */
export const warehouseTransactions = pgTable(
  'warehouse_transactions',
  {
    id: id(),
    itemId: integer('item_id').references(() => warehouseItems.id, { onDelete: 'set null' }),
    category: text('category').notNull(),
    itemName: text('item_name').notNull(),
    action: text('action').notNull(), // nhập | xuất (giữ nguyên giá trị từ client)
    quantity: doublePrecision('quantity').notNull(),
    note: text('note').notNull().default(''),
    createdBy: text('created_by').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('warehouse_transactions_created_idx').on(t.createdAt.desc()), index('warehouse_transactions_item_idx').on(t.itemId)],
);

/** Phiếu nhập sản lượng trong ngày (append-only). order_key = orders.group_id. */
export const warehouseDailyEntries = pgTable(
  'warehouse_daily_entries',
  {
    id: id(),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    orderKey: text('order_key').notNull(),
    orderNumber: text('order_number').notNull().default(''),
    repackQty: qty('repack_qty'),
    createdBy: text('created_by').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('warehouse_daily_entries_date_order_idx').on(t.workDate, t.orderKey), index('warehouse_daily_entries_order_idx').on(t.orderKey)],
);

/** Số lượng từng máy trong phiếu nhập sản lượng (xóa phiếu thì xóa theo). */
export const warehouseDailyEntryLines = pgTable(
  'warehouse_daily_entry_lines',
  {
    id: id(),
    entryId: integer('entry_id')
      .notNull()
      .references(() => warehouseDailyEntries.id, { onDelete: 'cascade' }),
    machineName: text('machine_name').notNull(),
    quantity: qty('quantity'),
  },
  (t) => [index('warehouse_daily_entry_lines_entry_idx').on(t.entryId)],
);

/** Chốt sổ kho theo ngày (mỗi ngày 1 lần). */
export const warehouseDailyClosings = pgTable('warehouse_daily_closings', {
  id: id(),
  workDate: date('work_date', { mode: 'string' }).notNull().unique(),
  createdBy: text('created_by').notNull(),
  closedAt: tz('closed_at').notNull().defaultNow(),
});

/** Số liệu từng đơn tại lần chốt sổ. */
export const warehouseDailyClosingLines = pgTable(
  'warehouse_daily_closing_lines',
  {
    id: id(),
    closingId: integer('closing_id')
      .notNull()
      .references(() => warehouseDailyClosings.id, { onDelete: 'cascade' }),
    orderKey: text('order_key').notNull(),
    orderNumber: text('order_number').notNull().default(''),
    packagingCode: text('packaging_code').notNull().default(''),
    grainSize: text('grain_size').notNull().default(''),
    // Tổng đơn, sản xuất hôm nay/lũy kế, đóng lại hôm nay/lũy kế, còn lại.
    orderTotal: qty('order_total'),
    producedToday: qty('produced_today'),
    producedCumulative: qty('produced_cumulative'),
    machineNames: text('machine_names').notNull().default(''),
    repackToday: qty('repack_today'),
    repackCumulative: qty('repack_cumulative'),
    remaining: qty('remaining'),
  },
  (t) => [unique('warehouse_daily_closing_lines_uq').on(t.closingId, t.orderKey)],
);

/** Bản chụp số liệu kho theo ngày, có số phiên bản. */
export const warehouseDailySnapshots = pgTable(
  'warehouse_daily_snapshots',
  {
    id: id(),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    version: integer('version').notNull(),
    snapshot: jsonb('snapshot').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique('warehouse_daily_snapshots_uq').on(t.workDate, t.version)],
);

/** Sản lượng lịch sử trước khi Kho trở thành nguồn sản lượng chính (theo group đơn). */
export const warehouseProductionBaselines = pgTable('warehouse_production_baselines', {
  orderKey: text('order_key').primaryKey(),
  baselineTons: qty('baseline_tons'),
  note: text('note').notNull().default(''),
  initializedAt: tz('initialized_at').notNull().defaultNow(),
});

// =====================================================================================
// PLC (C# Máy B gửi telemetry)
// =====================================================================================
/** Thiết bị PLC + API key + bản tin mới nhất (thay cho các Map trong RAM của server cũ). */
export const plcDevices = pgTable('plc_devices', {
  deviceId: text('device_id').primaryKey(), // 'MAY_B'
  // API key chỉ lưu bản băm; cờ còn hiệu lực, ngày tạo/thu hồi.
  apiKeyHash: text('api_key_hash'),
  apiKeyActive: boolean('api_key_active').notNull().default(false),
  apiKeyCreatedAt: tz('api_key_created_at'),
  apiKeyRevokedAt: tz('api_key_revoked_at'),
  // Bản tin mới nhất và thời điểm nhận.
  lastPayload: jsonb('last_payload'),
  lastReceivedAt: tz('last_received_at'),
  lastHistoryAt: tz('last_history_at'),
  createdAt: createdAt(),
});

/** Trạng thái tính toán theo máy (may1..may4): tồn silo A/B, phễu, hệ số, bộ đếm… */
export const plcMachineStates = pgTable('plc_machine_states', {
  machineId: text('machine_id').primaryKey(),
  deviceId: text('device_id')
    .notNull()
    .references(() => plcDevices.deviceId, { onDelete: 'cascade' }),
  state: jsonb('state').notNull(),
  updatedAt: updatedAt(),
});

/** Lịch sử bản tin PLC (tối đa 1 bản/phút/thiết bị). */
export const plcTelemetryHistory = pgTable(
  'plc_telemetry_history',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    deviceId: text('device_id')
      .notNull()
      .references(() => plcDevices.deviceId, { onDelete: 'cascade' }),
    receivedAt: tz('received_at').notNull().defaultNow(),
    payload: jsonb('payload').notNull(),
  },
  (t) => [index('plc_telemetry_history_device_time_idx').on(t.deviceId, t.receivedAt.desc())],
);

// =====================================================================================
// TÀI LIỆU EXCEL DÙNG CHUNG
// =====================================================================================
/** File Excel dùng chung (file thật trên Blob). */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    originalName: text('original_name').notNull(),
    blobPathname: text('blob_pathname').notNull().unique(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
    ownerId: integer('owner_id').references(() => users.id, { onDelete: 'set null' }),
    ownerName: text('owner_name').notNull().default(''),
    // Xóa mềm: chỉ đánh dấu, không xóa thật.
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('documents_owner_idx').on(t.ownerId)],
);

/** Quyền xem/sửa tài liệu của từng người. */
export const documentPermissions = pgTable(
  'document_permissions',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(), // view | edit
    grantedBy: integer('granted_by').references(() => users.id, { onDelete: 'set null' }),
    grantedAt: tz('granted_at').notNull().defaultNow(),
  },
  (t) => [
    // Khóa chính 2 cột: mỗi người 1 quyền trên 1 tài liệu.
    primaryKey({ columns: [t.documentId, t.userId] }),
    check('document_permissions_check', sql`${t.permission} IN ('view','edit')`),
    index('document_permissions_user_idx').on(t.userId),
  ],
);

/** Khóa tài liệu khi có người đang sửa (tự hết hạn). */
export const documentLocks = pgTable('document_locks', {
  documentId: uuid('document_id')
    .primaryKey()
    .references(() => documents.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull(),
  userName: text('user_name').notNull(),
  lockToken: uuid('lock_token').notNull(),
  acquiredAt: tz('acquired_at').notNull().defaultNow(),
  expiresAt: tz('expires_at').notNull(),
});

/** Nhật ký thao tác trên tài liệu. */
export const documentActivityLogs = pgTable(
  'document_activity_logs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: integer('user_id'),
    userName: text('user_name').notNull(),
    action: text('action').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('document_activity_logs_doc_idx').on(t.documentId, t.createdAt.desc())],
);

// =====================================================================================
// HỆ THỐNG
// =====================================================================================
/** Lưu trữ dữ liệu từ các bảng cũ không còn dùng (warehouse_production_* đời đầu) để không mất lịch sử. */
export const legacyRecords = pgTable(
  'legacy_records',
  {
    id: id(),
    sourceTable: text('source_table').notNull(),
    data: jsonb('data').notNull(),
    archivedAt: tz('archived_at').notNull().defaultNow(),
  },
  (t) => [index('legacy_records_source_idx').on(t.sourceTable)],
);

/** Cấu hình hệ thống dạng key/value (vd: tham số PLC, cài đặt chung) – thêm cấu hình không cần migration. */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: updatedAt(),
  updatedBy: text('updated_by').notNull().default(''),
});
