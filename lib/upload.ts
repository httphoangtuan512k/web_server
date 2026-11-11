"use client";
/**
 * File này: upload file/ảnh từ trình duyệt lên Vercel Blob (có nén ảnh trước).
 * Dùng ở: form đơn hàng, bảo trì, ảnh đại diện, tài liệu.
 */

import { upload } from "@vercel/blob/client";

/**
 * Upload thẳng từ trình duyệt lên Vercel Blob (store private) – không qua giới hạn 4,5 MB của API.
 * API cấp token tại POST /api/uploads/token (yêu cầu đăng nhập).
 */
// Thư mục lưu trên Blob.
export type UploadFolder = "orders" | "maintenance" | "avatars" | "documents";

/** Kết quả sau khi upload. */
export interface UploadResult {
  pathname: string;
  /** Đường dẫn hiển thị trong app: '/api/files/<pathname>' (ảnh). */
  appUrl: string;
  size: number;
  contentType: string;
}

/** Làm sạch tên file: bỏ dấu tiếng Việt, ký tự lạ → "-", tối đa 80 ký tự. */
const safeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80) || "file";

/** Upload 1 file vào thư mục `folder`, có thể báo % tiến độ qua onProgress. */
export async function uploadFile(file: File | Blob, folder: UploadFolder, name?: string, onProgress?: (pct: number) => void): Promise<UploadResult> {
  const fileName = safeName(name || (file instanceof File ? file.name : "file"));
  // File > 8MB thì chia nhiều phần khi upload.
  const res = await upload(`${folder}/${fileName}`, file, {
    access: "private",
    handleUploadUrl: "/api/uploads/token",
    contentType: file.type || undefined,
    multipart: file.size > 8 * 1024 * 1024,
    onUploadProgress: onProgress ? (e) => onProgress(Math.round(e.percentage)) : undefined,
  });
  // Trả về đường dẫn để app hiển thị file qua /api/files/…
  return {
    pathname: res.pathname,
    appUrl: "/api/files/" + res.pathname.split("/").map(encodeURIComponent).join("/"),
    size: file.size,
    contentType: res.contentType || file.type,
  };
}

/** Thu nhỏ ảnh trước khi upload (cạnh dài tối đa `max` px, JPEG). Ảnh nhỏ hơn giữ nguyên. */
export async function compressImage(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  // Không phải ảnh / là GIF → giữ nguyên.
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  // Tính tỉ lệ thu nhỏ; ảnh đã nhỏ và nhẹ thì không nén.
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 600 * 1024) return file;
  // Vẽ lại ảnh lên canvas cỡ mới rồi xuất JPEG.
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b || file), "image/jpeg", quality));
}

/** Nén + upload ảnh, trả về '/api/files/...' để lưu vào trường ảnh (imageData, faultImage, avatar…). */
export async function uploadImage(file: File, folder: Exclude<UploadFolder, "documents">): Promise<string> {
  const blob = await compressImage(file);
  const base = file.name.replace(/\.[^.]+$/, "");
  const res = await uploadFile(blob, folder, `${base}.jpg`);
  return res.appUrl;
}
