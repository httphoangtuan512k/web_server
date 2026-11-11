/** Bản ghi bảo trì – dạng dòng DB cũ (snake_case) trả về từ GET /api/maintenance. */
export interface MaintenanceRecord {
  id: number;
  created_at: string;
  updated_at?: string | null;
  equipment: string;
  fault_description: string;
  /** '/api/files/…' hoặc data-URL cũ; '' nếu không có ảnh. */
  fault_image: string;
  repair_content: string;
  after_status: string;
  after_image: string;
  created_by: string;
  /** Phòng khi server trả tên cột mới (fault_image_url / after_image_url). */
  fault_image_url?: string;
  after_image_url?: string;
}

/** GET /api/maintenance */
export interface MaintenanceResponse {
  records: MaintenanceRecord[];
  isSuper: boolean;
}

/** Thân POST /api/maintenance và PATCH /api/maintenance/:id */
export interface MaintenanceInput {
  equipment: string;
  faultDescription: string;
  faultImage: string;
  repairContent: string;
  afterStatus: string;
  afterImage: string;
}

export const faultImageOf = (r: MaintenanceRecord) => r.fault_image || r.fault_image_url || "";
export const afterImageOf = (r: MaintenanceRecord) => r.after_image || r.after_image_url || "";
