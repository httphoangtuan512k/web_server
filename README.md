# SUPER WHITE – Hệ thống quản lý sản xuất

Phần mềm nội bộ cho nhà máy bột đá **SUPER WHITE – Calcium Carbonate**: kế hoạch đơn hàng, vận hành máy nghiền, giám sát PLC, kho, bảo trì và tài liệu dùng chung.

> **Người mới?** Đọc trước: [Hướng dẫn đọc code](docs/HUONG_DAN_DOC_CODE.md) · [Git cho người mới (pull / add / commit / push)](docs/git/README.md).
> Mọi file code đều có chú thích tiếng Việt giải thích từng phần.

**Một ứng dụng duy nhất**: giao diện Next.js và API NestJS chạy chung một tiến trình, một link. Mọi request `/api/*` được `pages/api/[...path].ts` chuyển thẳng vào NestJS.

| Thư mục | Nội dung |
|---|---|
| `app/`, `components/`, `lib/`, `public/` | Giao diện – Next.js 16 (App Router) · React 19 · Tailwind CSS v4 |
| `pages/api/[...path].ts` | Cửa ngõ API: chuyển `/api/*` vào NestJS |
| `server/src/` | API – NestJS 11 · Drizzle ORM · Postgres (Neon) · Vercel Blob (private) |
| `server/db/migrations/` | Migration SQL có version |
| `server/scripts/` | Migrate, đồng bộ dữ liệu từ hệ thống cũ, tạo Super Admin |
| `docs/` | Kế hoạch chuyển đổi, quy ước code |

## Chạy trên máy

Yêu cầu: Node.js ≥ 20, Postgres (local hoặc Neon).

```bash
cp .env.example .env.local     # điền DATABASE_URL, BLOB_READ_WRITE_TOKEN, SESSION_SECRET, CRON_SECRET
npm install
npm run db:migrate             # tạo/cập nhật bảng
npm run create-super-admin -- <username> <mật-khẩu-≥10-ký-tự> "Họ tên"   # lần đầu, nếu DB trống

npm run dev                    # mở http://localhost:3000 (web + API cùng 1 link)
```

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy web + API (tự tải lại khi sửa code) |
| `npm run build` / `npm start` | Build và chạy bản production |
| `npm run typecheck` / `npm run lint` | Kiểm tra TypeScript / ESLint |
| `npm run db:generate -- --name <mo_ta>` | Sinh migration sau khi sửa `server/src/db/schema.ts` |
| `npm run db:migrate` | Áp dụng migration chưa chạy |
| `npm run db:studio` | Xem/sửa dữ liệu trên trình duyệt |
| `npm run db:import -- <superwhite.db> --excel-dir <web/data/excel/files> [--wipe]` | Đồng bộ dữ liệu từ server cũ (SQLite) |

Các script DB đọc `.env.local`. Muốn chạy với DB khác: `DATABASE_URL=<url> npm run db:migrate`.

## Deploy lên Vercel

1. Vercel → **Add New → Project** → import repo này. Giữ nguyên mọi thiết lập (Framework: Next.js, Root Directory: gốc repo).
2. **Environment Variables**: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `SESSION_SECRET`, `CRON_SECRET` (xem `.env.example`). Nếu đã gắn Neon và Blob qua tab **Storage** thì 2 biến đầu tự có.
3. **Deploy**. Cron sao lưu 23:59 giờ VN đã khai báo trong `vercel.json`.
4. Lần đầu (hoặc khi có migration mới): từ máy local chạy `DATABASE_URL=<neon-url> npm run db:migrate`.
5. Chương trình C# Máy B gửi PLC tới `https://<domain>/api/plc/telemetry` (header `x-api-key`, key giữ nguyên từ hệ thống cũ).

Chi tiết: [`docs/MIGRATION_PLAN.md`](docs/MIGRATION_PLAN.md) · Quy ước code: [`docs/PORTING_GUIDE.md`](docs/PORTING_GUIDE.md).
