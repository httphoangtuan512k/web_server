// File này: khai báo hình dạng dữ liệu của trang Dữ liệu gốc (bảng, cột, dòng).
// Dùng ở: các component trang Dữ liệu gốc.
/** GET /api/super-data/tables */
export interface SuperTable {
  name: string;
  label: string;
}

/** Mô tả cột – `type` là kiểu SQL (Postgres: data_type hoặc udt_name, vd 'integer', 'timestamptz', 'jsonb', '_text'). */
export interface SuperColumn {
  name: string;
  type: string;
  notnull: boolean;
  pk: boolean;
}

// Giá trị một ô: chữ, số, đúng/sai, rỗng, hoặc dữ liệu JSON.
export type CellValue = string | number | boolean | null | Record<string, unknown> | unknown[];

// Một dòng: khóa chính (để nhận diện) + giá trị các cột.
export interface SuperRow {
  /** Giá trị khóa chính – gửi nguyên lại khi PATCH/DELETE. */
  key: Record<string, CellValue>;
  values: Record<string, CellValue>;
}

/** GET /api/super-data/:table?q= (tối đa 200 dòng). */
export interface SuperTableData {
  table: string;
  label: string;
  primaryKey: string[];
  columns: SuperColumn[];
  rows: SuperRow[];
}

/** Kiểu input khi sửa. */
export type ColumnKind = "boolean" | "number" | "json" | "datetime" | "date" | "longtext" | "text";
