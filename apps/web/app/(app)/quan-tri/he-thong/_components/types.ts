/**
 * Một bản sao lưu – GET /api/superadmin/backups → `{ rows: BackupItem[] }`.
 * Server cũ chỉ trả `{ name, createdAt }` (thư mục trên đĩa); bản mới lưu trên Blob nên cần thêm
 * `pathname` (dùng cho `/api/superadmin/backups/download?path=`). `size` (byte) không bắt buộc.
 */
export interface BackupItem {
  name: string;
  createdAt: string;
  pathname?: string;
  /** Tên khóa thay thế nếu backend dùng `path`. */
  path?: string;
  size?: number;
}

export interface BackupListResponse {
  rows: BackupItem[];
}

/** POST /api/superadmin/backups */
export interface BackupCreateResponse {
  ok: boolean;
  name: string;
  pathname?: string;
}

/** GET /api/superadmin/plc-device */
export interface PlcDeviceStatus {
  device_id: string;
  key_active: boolean;
  key_created_at: string;
  key_revoked_at: string;
  /** Nhận dữ liệu trong ~5 giây gần nhất. */
  connected: boolean;
  last_received_at: string;
}

/** POST /api/superadmin/plc-device/key */
export interface PlcKeyResponse {
  ok: boolean;
  device_id: string;
  api_key: string;
  created_at: string;
  warning?: string;
}
