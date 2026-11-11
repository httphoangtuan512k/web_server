import { fmtDateTime } from "@/lib/format";
import { fromVnInputValue, toVnInputValue } from "../../_shared/utils";
import type { CellValue, ColumnKind, SuperColumn } from "./types";

/** Nhãn tiếng Việt cho tên cột (giữ từ trang cũ + bổ sung cột của schema mới). */
const LABELS: Record<string, string> = {
  id: "Mã bản ghi",
  order_number: "Số đơn hàng",
  item_code: "Mã hàng",
  packaging_code: "Mã bao bì",
  quantity: "Số lượng",
  image_data: "Ảnh đơn hàng",
  image_url: "Ảnh đơn hàng",
  whiteness: "Độ trắng",
  grain_size: "Cỡ hạt",
  bag_weight: "Khối lượng bao",
  coating_rate: "Tỷ lệ tráng",
  stone_type: "Loại đá",
  impurity: "Tạp chất",
  pallet: "Pallet",
  extra_bag: "Bao phụ",
  order_command: "Lệnh chạy máy",
  run_on_machine: "Số máy chạy",
  actual_produced: "Sản lượng thực tế",
  status: "Trạng thái",
  is_paused: "Đang tạm dừng",
  export_date: "Ngày xuất hàng",
  created_at: "Thời gian tạo",
  updated_at: "Thời gian cập nhật",
  created_by: "Người tạo (ID)",
  created_by_id: "Người tạo (ID)",
  updated_by: "Người sửa (ID)",
  creator_name: "Người tạo",
  runner_name: "Người vận hành",
  confirmer_name: "Người xác nhận",
  kho_name: "Người xác nhận kho",
  machine_name: "Tên máy",
  kho_bu: "Sản lượng bù kho",
  parent_order_id: "Mã đơn gốc",
  group_id: "Mã nhóm đơn",
  order_id: "Mã đơn",
  completed_at: "Thời gian hoàn thành",
  username: "Tên đăng nhập",
  role: "Vai trò",
  active: "Tài khoản hoạt động",
  is_active: "Tài khoản hoạt động",
  is_super: "Super Admin",
  full_name: "Họ và tên",
  position: "Chức danh",
  avatar: "Ảnh đại diện",
  avatar_url: "Ảnh đại diện",
  page_permissions: "Quyền truy cập trang",
  order_permissions: "Quyền đơn hàng",
  user_id: "Mã tài khoản",
  login_at: "Đăng nhập lúc",
  last_seen_at: "Hoạt động gần nhất",
  logout_at: "Đăng xuất lúc",
  ip_address: "Địa chỉ IP",
  user_agent: "Thiết bị / Trình duyệt",
  event_type: "Loại sự kiện",
  machine_count: "Số máy",
  actual_tons: "Sản lượng (tấn)",
  user_name: "Người thao tác",
  action: "Thao tác",
  old_value: "Giá trị cũ",
  new_value: "Giá trị mới",
  actor: "Người thực hiện",
  actor_id: "Người thực hiện (ID)",
  action_type: "Loại thao tác",
  target_id: "Mã đối tượng",
  details: "Chi tiết",
  work_date: "Ngày làm việc",
  closing_id: "Mã chốt kho",
  order_key: "Mã đơn",
  order_total: "Tổng đơn (tấn)",
  produced_today: "Sản lượng hôm nay",
  produced_cumulative: "Sản lượng lũy kế",
  machine_names: "Danh sách máy",
  repack_today: "Đóng lại hôm nay",
  repack_cumulative: "Đóng lại lũy kế",
  remaining: "Còn lại (tấn)",
  code: "Mã hàng",
  name: "Tên",
  unit: "Đơn vị",
  lot_number: "Số lô",
  shelf_number: "Vị trí kệ",
  category: "Danh mục",
  item_id: "Mã mặt hàng",
  item_name: "Tên mặt hàng",
  note: "Ghi chú",
  fault_description: "Mô tả sự cố",
  fault_image: "Ảnh sự cố",
  fault_image_url: "Ảnh sự cố",
  repair_content: "Nội dung sửa chữa",
  after_status: "Trạng thái sau sửa",
  after_image: "Ảnh sau sửa",
  after_image_url: "Ảnh sau sửa",
  equipment: "Thiết bị",
  version: "Phiên bản",
  snapshot: "Ảnh chụp dữ liệu",
  device_id: "Mã thiết bị",
  received_at: "Nhận lúc",
  payload: "Dữ liệu gửi lên",
  state: "Trạng thái (JSON)",
  key: "Khóa",
  value: "Giá trị",
  blob_pathname: "Đường dẫn file",
  original_name: "Tên file gốc",
  owner_id: "Chủ sở hữu (ID)",
  document_id: "Mã tài liệu",
  size: "Dung lượng",
  content_type: "Loại file",
};

export function labelOf(name: string) {
  return LABELS[name] || name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_LABEL: Record<string, string> = { new: "Mới tạo", running: "Đang chạy", completed: "Hoàn thành" };
const BOOL_COLUMNS = new Set(["active", "is_active", "is_super", "is_paused"]);

/** Xác định kiểu input theo kiểu SQL (+ giá trị mẫu để dự phòng). */
export function kindOf(col: SuperColumn, sample?: CellValue): ColumnKind {
  const t = (col.type || "").toLowerCase().trim();
  if (/^bool/.test(t) || BOOL_COLUMNS.has(col.name)) return "boolean";
  if (/json/.test(t) || /^_|\[\]$|^array/.test(t)) return "json";
  if (/timestamp|timestamptz/.test(t)) return "datetime";
  if (t === "date") return "date";
  if (t === "interval") return "text";
  if (/int|real|floa|doub|num|dec|serial|money/.test(t)) return "number";
  if (typeof sample === "boolean") return "boolean";
  if (typeof sample === "number") return "number";
  if (sample !== null && typeof sample === "object") return "json";
  const long = typeof sample === "string" && sample.length > 100;
  if (long || /image|description|details|content|avatar|note|user_agent/i.test(col.name)) return "longtext";
  return "text";
}

/** Cột chứa ảnh hiển thị được. */
export function isImageValue(v: CellValue): v is string {
  return typeof v === "string" && (v.startsWith("/api/files/") || v.startsWith("data:image/") || /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?|$)/i.test(v));
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Chuỗi hiển thị đầy đủ (tooltip). */
export function rawText(v: CellValue): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Giá trị hiển thị gọn trong ô bảng. */
export function displayValue(name: string, v: CellValue, kind: ColumnKind): string {
  if (v === null || v === undefined || v === "") return "—";
  if (name === "status" && typeof v === "string") return STATUS_LABEL[v] ?? v;
  if (kind === "boolean") return v === true || v === 1 || v === "1" || v === "true" ? "Có" : "Không";
  if (kind === "datetime" || (typeof v === "string" && ISO_RE.test(v) && kind !== "date")) return fmtDateTime(v as string, String(v));
  if (typeof v === "string" && v.startsWith("data:")) return `[dữ liệu ${v.slice(5, v.indexOf(";")) || "nhị phân"} · ${Math.round(v.length / 1024)} KB]`;
  const s = rawText(v);
  return s.length > 180 ? `${s.slice(0, 180)}…` : s;
}

/** Giá trị → chuỗi trong form sửa. */
export function toFormValue(v: CellValue, kind: ColumnKind): string | boolean {
  if (kind === "boolean") return v === true || v === 1 || v === "1" || v === "true";
  if (v === null || v === undefined) return "";
  if (kind === "json") return JSON.stringify(v, null, 2);
  if (kind === "datetime") return toVnInputValue(String(v));
  if (kind === "date") return String(v).slice(0, 10);
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** Chuỗi trong form → giá trị gửi lên server. Ném Error (tiếng Việt) nếu không hợp lệ. */
export function fromFormValue(col: SuperColumn, kind: ColumnKind, v: string | boolean): CellValue {
  const label = labelOf(col.name);
  if (kind === "boolean") return Boolean(v);
  const s = String(v);
  if (s.trim() === "") {
    if (!col.notnull) return null;
    if (kind === "text" || kind === "longtext") return "";
    throw new Error(`“${label}” không được để trống.`);
  }
  switch (kind) {
    case "number": {
      const n = Number(s.trim().replace(",", "."));
      if (!Number.isFinite(n)) throw new Error(`“${label}” phải là số.`);
      return n;
    }
    case "json":
      try {
        return JSON.parse(s) as CellValue;
      } catch {
        throw new Error(`“${label}” không phải JSON hợp lệ.`);
      }
    case "datetime": {
      const iso = fromVnInputValue(s);
      if (!iso) throw new Error(`“${label}” không phải thời gian hợp lệ.`);
      return iso;
    }
    default:
      return s;
  }
}
