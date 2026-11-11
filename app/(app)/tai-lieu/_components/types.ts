/**
 * File này: mô tả dạng dữ liệu tài liệu nhận từ máy chủ + hàm kiểm tra file Excel.
 * Dùng ở: mọi file trong tai-lieu/_components. Không tự hiện gì trên màn hình.
 */
/** Kiểu JSON của /api/tai-lieu/* (giữ khóa như excel-manager.js cũ). */

// Quyền của tôi với tài liệu: chủ sở hữu / được sửa / chỉ xem.
export type MyPermission = "owner" | "edit" | "view";

// Một tài liệu Excel: tên, người tải lên, dung lượng, thời gian, quyền của tôi.
export interface DocumentFile {
  id: string;
  original_name: string;
  owner_user_id: number | null;
  owner_name: string;
  /** BIGINT – có thể là chuỗi. */
  size_bytes: number | string;
  created_at: string;
  updated_at: string;
  my_permission: MyPermission | null;
  /** = updated_at (ms) – gửi lại khi cập nhật để phát hiện xung đột. */
  version: number;
}

/** GET /api/tai-lieu/files */
export interface FilesResponse {
  files: DocumentFile[];
  isSuper: boolean;
  currentUserId: number;
}

/** GET /api/tai-lieu/users */
// Một người dùng có thể được cấp quyền.
export interface DocUser {
  id: number;
  username: string;
  fullName: string;
  position: string;
}

/** GET /api/tai-lieu/:id/permissions → { permissions } */
// Một người đã được cấp quyền xem hoặc sửa.
export interface DocPermission {
  user_id: number;
  permission: "view" | "edit";
  granted_at: string;
  username: string;
  full_name: string;
}

/** GET /api/tai-lieu/:id/history → { history } */
// Một dòng lịch sử: ai làm gì, lúc nào.
export interface DocHistoryItem {
  user_name: string;
  action: string;
  created_at: string;
}

/** POST /api/tai-lieu/:id/lock */
// Kết quả khi xin khóa chỉnh sửa: mã khóa và giờ hết hạn.
export interface LockResponse {
  ok: boolean;
  token: string;
  expiresAt: string;
  message?: string;
}

// Đuôi file Excel được nhận, giới hạn 50 MB.
export const EXCEL_EXTS = [".xlsx", ".xlsm", ".xls", ".xlsb"];
export const MAX_BYTES = 50 * 1024 * 1024;
export const ACCEPT = EXCEL_EXTS.join(",");

// Loại nội dung (MIME) theo đuôi file.
const MIME: Record<string, string> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
  ".xls": "application/vnd.ms-excel",
  ".xlsb": "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
};

// Lấy đuôi file viết thường, vd "Bao_cao.XLSX" → ".xlsx".
export const extOf = (name: string) => {
  const m = /\.[^.]+$/.exec(name || "");
  return m ? m[0].toLowerCase() : "";
};

/** Kiểm tra file Excel trước khi upload; trả về câu lỗi hoặc null. */
export function validateExcel(file: File): string | null {
  // Sai đuôi, quá 50 MB, hoặc file rỗng → báo lỗi.
  if (!EXCEL_EXTS.includes(extOf(file.name))) return "Chỉ chấp nhận file Excel .xlsx, .xlsm, .xls hoặc .xlsb.";
  if (file.size > MAX_BYTES) return "File vượt quá 50 MB.";
  if (file.size === 0) return "File rỗng.";
  return null;
}

// Loại nội dung của file khi tải lên (đoán theo đuôi nếu thiếu).
export const contentTypeOf = (file: File, uploaded?: string) => uploaded || file.type || MIME[extOf(file.name)] || "application/octet-stream";

// Chữ hiện trên màn hình cho từng loại quyền.
export const PERMISSION_LABEL: Record<MyPermission, string> = {
  owner: "Chủ sở hữu",
  edit: "Xem và cập nhật",
  view: "Chỉ xem",
};
