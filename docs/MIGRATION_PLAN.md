# Kế hoạch chuyển SUPER WHITE từ `web/` (Express + SQLite) sang `web_server/` (NestJS + Next.js + Vercel)

## 1. Hiện trạng (`web/`)

| Thành phần | Hiện tại | Vấn đề khi lên Vercel |
|---|---|---|
| Backend | 1 file `server.js` (~2.000 dòng, Express 5) | Vercel chạy serverless, không có tiến trình sống lâu |
| Database | SQLite `data/superwhite.db` (better-sqlite3, đồng bộ) | Không có ổ đĩa bền vững → phải dùng Postgres (Neon) |
| Phiên đăng nhập | `express-session` lưu trong RAM, secret ở `data/session.secret` | RAM mất sau mỗi lần gọi hàm → chuyển sang cookie ký JWT + bảng `login_sessions` |
| Ảnh (đơn hàng, bảo trì, avatar) | Base64 nhét thẳng trong cột DB | DB phình to; chuyển sang **Vercel Blob**, cột chỉ lưu URL |
| Tài liệu Excel | File trên đĩa `data/excel/files` + Postgres riêng | Chuyển sang Vercel Blob + chung Neon DB |
| Trạng thái PLC | `Map` trong RAM (cache, mốc lịch sử, trạng thái máy) | Lưu hết trong DB (`plc_device_status`, `plc_operation_state`) |
| Sao lưu | `setTimeout` 23:59 copy file DB ra `BACKUPS/` | Vercel Cron gọi `/api/cron/daily-backup` → dump JSON lên Blob; Neon có PITR |
| Xuất Excel bảo trì | Ghi file vào `BAOTRI_EXPORTS/` | Ghi lên Blob `baotri-exports/YYYY/MM/` |
| Ngày giờ | Dùng giờ máy chủ Windows (giờ VN) | Vercel chạy UTC → mọi "ngày làm việc" tính theo `Asia/Ho_Chi_Minh` |
| Frontend | HTML + JS thuần, gọi `/api/...` | Next.js (App Router, React, TS), giữ nguyên giao diện và API |

## 2. Kiến trúc mới

```
web_server/                 MỘT ứng dụng Next.js (Vercel project duy nhất, Root Directory = gốc repo)
├── app/, components/, lib/ giao diện Next.js 16 – design system theo màu logo, sidebar theo quyền
│                           /login, / (tổng quan), /ke-hoach, /van-hanh, /plc, /kho, /bao-tri, /kcs, /xuat-hang,
│                           /tai-lieu, /quan-tri/{nguoi-dung,nhat-ky,he-thong,du-lieu}
├── pages/api/[...path].ts  chuyển mọi /api/* vào NestJS trong cùng tiến trình (1 domain ⇒ cookie đơn giản)
├── proxy.ts                chưa đăng nhập → về /login; redirect *.html cũ trong next.config.ts
└── server/
    ├── src/
    │   ├── db/             schema.ts (Drizzle – nguồn duy nhất của cấu trúc DB), DbService (Drizzle + SQL thuần, transaction)
    │   ├── blob/           BlobService (store private), /api/files/* (phục vụ ảnh), /api/uploads/token (upload trực tiếp)
    │   ├── auth/           đăng nhập, cookie ký HMAC + bảng user_sessions, Guard: đăng nhập / admin / super / quyền trang
    │   ├── common/         lỗi `{error}`, giờ VN
    │   └── modules/        users, orders, history, maintenance, backup, warehouse, super-data, plc, documents
    ├── db/migrations/      migration SQL có version (drizzle-kit)
    └── scripts/            migrate, import dữ liệu SQLite → Neon + ảnh → Blob, tạo super admin
```

**Nguyên tắc:** giữ nguyên **đường dẫn API, tham số và dạng JSON trả về** như `server.js`, kể cả mã HTTP và `{ error: "..." }` (danh sách ngoại lệ trong `PORTING_GUIDE.md` §2.1). Nhờ vậy chương trình C# gửi PLC chỉ cần đổi URL.

## 2b. Thiết kế lại cơ sở dữ liệu

Thay vì chép 1:1 từ SQLite, schema được tối ưu để dễ nâng cấp (chi tiết ánh xạ: `PORTING_GUIDE.md` §4):

- **Drizzle ORM**: schema bằng TypeScript có kiểu, migration có version (`db:generate` → `db:migrate`), không còn `ALTER TABLE` rải trong code khởi động.
- **Kiểu dữ liệu chuẩn**: `timestamptz` cho thời điểm, `date` cho ngày làm việc, `boolean` cho cờ, `jsonb` cho dữ liệu mềm, `text[]` cho danh sách quyền.
- **Toàn vẹn**: khóa ngoại thật (`ON DELETE SET NULL/CASCADE`), CHECK cho trạng thái/vai trò/loại hàng, UNIQUE cho snapshot theo ngày.
- **Gọn hơn**: `order_status_permissions` → `users.order_permissions`; 3 bảng hàng hóa/bao bì/vật tư → `warehouse_items`; PLC gom về `plc_devices`;
  cột sinh `orders.group_id` thay cho biểu thức `COALESCE(NULLIF(parent_order_id,''),id)` lặp lại khắp nơi; bảng đời cũ không dùng → `legacy_records`.
- **Tiện vận hành**: trigger tự cập nhật `updated_at`, bảng `app_settings` (key/value) cho cấu hình mới không cần migration, index cho các truy vấn chính.

## 3. Dịch vụ & biến môi trường

| Biến | Dùng ở | Ghi chú |
|---|---|---|
| `DATABASE_URL` | server | Neon Postgres (URL pooler) |
| `BLOB_READ_WRITE_TOKEN` | server | Vercel Blob store (ảnh, tài liệu, backup, xuất Excel) |
| `SESSION_SECRET` | server | chuỗi ngẫu nhiên ≥ 32 ký tự để ký cookie |
| `CRON_SECRET` | server | Vercel tự gửi kèm khi gọi cron |

Secret **không bao giờ commit**; chỉ để trong `.env` cục bộ (đã gitignore) và trong Vercel → Settings → Environment Variables.

## 4. Các giai đoạn

### Giai đoạn 0 – Nền tảng
- [x] Clone repo, dựng ứng dụng Next.js + NestJS (gộp thành 1 ứng dụng, 1 project Vercel)
- [x] Schema Drizzle + migration (mục 2b), áp dụng lên Neon
- [x] DbService, BlobService, Auth (cookie ký HMAC + bảng `user_sessions`), Guard phân quyền, filter lỗi
- [x] Upload trực tiếp từ trình duyệt lên Blob qua `/api/uploads/token` (vượt giới hạn 4,5 MB body của Vercel)

### Giai đoạn 1 – Port backend (giữ nguyên hành vi)
- Người dùng, phiên đăng nhập, đơn hàng (tạo, sửa, tách, chạy/dừng/tiếp tục/hoàn thành, xuất Excel), lịch sử, audit log
- Bảo trì + xuất Excel theo ngày; kho (nhập theo ngày, chốt ngày, snapshot, hàng hóa, bao bì, vật tư, giao dịch)
- PLC: telemetry từ C# Máy B, tính tồn silo/phễu/sản lượng, lưu trạng thái trong DB, lịch sử 1 phút/lần
- Super data (xem/sửa/xóa bảng), sao lưu (Cron + thủ công) lên Blob, kho tài liệu Excel (phân quyền, khóa, lịch sử)
- `better-sqlite3` đồng bộ → `pg` bất đồng bộ: mọi `db.transaction` chuyển thành `db.tx(async t => …)`

### Giai đoạn 2 – Port frontend sang Next.js
- **Thiết kế lại** giao diện: design system theo màu logo (xanh/cam), sidebar điều hướng theo quyền, responsive cho điện thoại/tablet ở xưởng, chế độ tối
- Mỗi file HTML thành 1 route React, giữ đủ 100% chức năng cũ
- Ảnh: nếu trường có URL thì hiển thị trực tiếp; ảnh mới upload lên Blob hoặc gửi data-URL nhỏ (API tự đẩy lên Blob)
- `kcs`, `xuathang`: hiện đang trống → làm trang "Đang phát triển"

### Giai đoạn 3 – Chuyển dữ liệu
1. [x] `npm run db:migrate` tạo bảng trên Neon
2. [x] `npm run db:import -- <web>/data/superwhite.db --excel-dir <web>/data/excel/files`: chuẩn hóa dữ liệu sang schema mới; ảnh base64 → Blob (tên theo hash, chạy lại không trùng); file Excel → Blob
3. [x] Đối chiếu số dòng từng bảng (script tự in bảng so sánh) – khớp 100% lần đồng bộ 11/11/2026
4. [ ] Trước khi chuyển hẳn: dừng server cũ, chạy lại `db:import -- … --wipe` với file `superwhite.db` mới nhất

### Giai đoạn 4 – Deploy Vercel
1. Vercel → New Project → import repo → giữ nguyên thiết lập (Next.js, gốc repo) → thêm 4 biến môi trường → Deploy
2. Kiểm tra `https://<domain>/api/health` trả `{"ok":true}`, đăng nhập thử
3. Gắn Blob store + Neon vào project (Storage tab) nếu chưa
4. Cập nhật chương trình C# Máy B: đổi URL sang `https://<domain>/api/plc/telemetry` (API key giữ nguyên vì hash đã được migrate)
5. Bỏ Cloudflare Tunnel; chạy song song 1–2 ngày rồi tắt server cũ

## 5. Rủi ro & cách xử lý

| Rủi ro | Xử lý |
|---|---|
| PLC gửi dữ liệu dày (vài giây/lần) → nhiều lần gọi hàm | Trong giới hạn Vercel; trạng thái máy cập nhật trong transaction có khóa `FOR UPDATE` để không bị ghi chồng |
| Cold start Nest (~1 s) | Cache app giữa các lần gọi; Fluid compute của Vercel giữ instance ấm |
| Body > 4,5 MB | File lớn upload thẳng lên Blob từ trình duyệt |
| Lệch ngày do UTC | Mọi `dateKey` dùng `vnDateKey()` (Asia/Ho_Chi_Minh) |
| URL Blob là public (khó đoán) | Tài liệu tải qua API có kiểm tra quyền; URL có hậu tố ngẫu nhiên |
| Cron Hobby chỉ 1 lần/ngày | Đủ cho sao lưu 23:59 (16:59 UTC) |
