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
web_server/
├── apps/api   NestJS 11 (TypeScript) – REST API, deploy thành 1 Vercel project (Root Directory = apps/api)
│   ├── api/index.js        hàm serverless Vercel, bọc Nest app (cache giữa các lần gọi)
│   ├── db/schema.sql       schema Postgres (chuyển 1:1 từ SQLite)
│   ├── scripts/            migrate schema, import dữ liệu SQLite → Neon + ảnh → Blob, tạo super admin
│   └── src/
│       ├── db/             DbService (pg Pool, hỗ trợ placeholder `?` như SQLite, transaction)
│       ├── blob/           BlobService (Vercel Blob: put/del/list, đổi data-URL → URL)
│       ├── auth/           đăng nhập, cookie JWT, Guard: đăng nhập / admin / super / quyền trang
│       ├── common/         lỗi `{error}`, giờ VN, tiện ích
│       └── modules/        users, orders, history, maintenance, backup, warehouse,
│                           super-data, plc, documents, uploads
└── apps/web   Next.js 16 (TypeScript) – giao diện, deploy thành Vercel project thứ 2 (Root Directory = apps/web)
    ├── next.config.ts      rewrite `/api/*` → API_URL (cùng domain ⇒ cookie hoạt động), redirect `*.html` cũ
    ├── proxy.ts            chưa đăng nhập → về trang đăng nhập
    └── app/                /, /trangchu, /admin, /log, /superdata, /quanlytailieu,
                            /kehoach, /vanhanh, /dataplc, /kho, /baotri, /kcs, /xuathang
```

**Nguyên tắc quan trọng nhất:** giữ nguyên **đường dẫn API, tham số và dạng JSON trả về** như `server.js`, kể cả mã HTTP và `{ error: "..." }`. Vì vậy frontend port 1:1, và chương trình C# gửi PLC chỉ cần đổi URL.

## 3. Dịch vụ & biến môi trường

| Biến | Dùng ở | Ghi chú |
|---|---|---|
| `DATABASE_URL` | api | Neon Postgres (URL pooler) |
| `BLOB_READ_WRITE_TOKEN` | api | Vercel Blob store (ảnh, tài liệu, backup, xuất Excel) |
| `SESSION_SECRET` | api | chuỗi ngẫu nhiên ≥ 32 ký tự để ký cookie |
| `CRON_SECRET` | api | Vercel tự gửi kèm khi gọi cron |
| `API_URL` | web | URL của project API, ví dụ `https://superwhite-api.vercel.app` |

Secret **không bao giờ commit**; chỉ để trong `.env` cục bộ (đã gitignore) và trong Vercel → Settings → Environment Variables.

## 4. Các giai đoạn

### Giai đoạn 0 – Nền tảng
- [x] Clone repo, dựng monorepo `apps/api` + `apps/web`
- [x] Schema Postgres `db/schema.sql` (TEXT giữ nguyên định dạng ISO, REAL → DOUBLE PRECISION, AUTOINCREMENT → IDENTITY)
- [x] DbService, BlobService, Auth (cookie JWT + bảng `login_sessions`), Guard phân quyền, filter lỗi
- [x] Upload trực tiếp từ trình duyệt lên Blob qua `/api/uploads/token` (vượt giới hạn 4,5 MB body của Vercel)

### Giai đoạn 1 – Port backend (giữ nguyên hành vi)
- Người dùng, phiên đăng nhập, đơn hàng (tạo, sửa, tách, chạy/dừng/tiếp tục/hoàn thành, xuất Excel), lịch sử, audit log
- Bảo trì + xuất Excel theo ngày; kho (nhập theo ngày, chốt ngày, snapshot, hàng hóa, bao bì, vật tư, giao dịch)
- PLC: telemetry từ C# Máy B, tính tồn silo/phễu/sản lượng, lưu trạng thái trong DB, lịch sử 1 phút/lần
- Super data (xem/sửa/xóa bảng), sao lưu (Cron + thủ công) lên Blob, kho tài liệu Excel (phân quyền, khóa, lịch sử)
- `better-sqlite3` đồng bộ → `pg` bất đồng bộ: mọi `db.transaction` chuyển thành `db.tx(async t => …)`

### Giai đoạn 2 – Port frontend sang Next.js
- Mỗi file HTML thành 1 route React (client component), giữ nguyên CSS/bố cục/chữ tiếng Việt
- Ảnh: nếu trường có URL thì hiển thị trực tiếp; ảnh mới upload lên Blob hoặc gửi data-URL nhỏ (API tự đẩy lên Blob)
- `kcs`, `xuathang`: hiện đang trống → làm trang "Đang phát triển"

### Giai đoạn 3 – Chuyển dữ liệu
1. `npm run db:migrate` (trong `apps/api`) tạo bảng trên Neon
2. `npm run db:import -- ../../../web/data/superwhite.db` copy toàn bộ bảng; ảnh base64 → Blob → URL; file Excel tài liệu → Blob
3. Đối chiếu số dòng từng bảng (script tự in bảng so sánh)

### Giai đoạn 4 – Deploy Vercel
1. Vercel → New Project → import repo → **Root Directory `apps/api`** → thêm biến môi trường → Deploy
2. New Project thứ 2 → **Root Directory `apps/web`** → `API_URL` = URL bước 1 → Deploy
3. Gắn Blob store + Neon vào project API (Storage tab) nếu chưa
4. Cập nhật chương trình C# Máy B: đổi URL sang `https://<web>/api/plc/telemetry` (API key giữ nguyên vì hash đã được migrate)
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
