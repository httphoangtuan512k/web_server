# SUPER WHITE – Hệ thống quản lý sản xuất

Phần mềm nội bộ cho nhà máy bột đá **SUPER WHITE – Calcium Carbonate**: kế hoạch đơn hàng, vận hành máy nghiền, giám sát PLC, kho, bảo trì và tài liệu dùng chung.

| Thư mục | Công nghệ | Deploy |
|---|---|---|
| `apps/api` | NestJS 11 · TypeScript · Drizzle ORM · Postgres (Neon) · Vercel Blob | Vercel project #1 (Root Directory `apps/api`) |
| `apps/web` | Next.js 16 (App Router) · React 19 · Tailwind CSS v4 | Vercel project #2 (Root Directory `apps/web`) |
| `docs/` | Kế hoạch chuyển đổi, hướng dẫn port, quy ước | – |

Trình duyệt chỉ làm việc với `apps/web`; mọi request `/api/*` được Next.js chuyển tiếp sang `apps/api` (cùng domain nên cookie đăng nhập hoạt động bình thường).

## Chạy local

Yêu cầu: Node.js ≥ 20, Postgres (local hoặc Neon).

```bash
# Lần đầu
cp apps/api/.env.example apps/api/.env      # điền DATABASE_URL, BLOB_READ_WRITE_TOKEN, SESSION_SECRET, CRON_SECRET
npm run setup                               # cài thư viện cho cả api + web
npm run db:migrate                          # tạo/cập nhật bảng
npm run create-super-admin --prefix apps/api -- <username> <mật-khẩu-≥10-ký-tự> "Họ tên"

# Hằng ngày: chạy cả API + Web bằng 1 lệnh
npm run dev                                 # mở http://localhost:3000  (API chạy ngầm ở :4000)
```

Đổi cổng: `WEB_PORT=3001 API_PORT=4001 npm run dev`. Ctrl+C dừng cả hai.

| Lệnh (ở thư mục gốc) | Tác dụng |
|---|---|
| `npm run dev` | Chạy API + Web, log gộp có nhãn `[api]`/`[web]` |
| `npm run build` | Build cả hai |
| `npm run typecheck` | Kiểm tra kiểu TypeScript cả hai |
| `npm run db:migrate` / `npm run db:studio` | Migration / xem dữ liệu |

## Cơ sở dữ liệu

- Schema khai báo bằng TypeScript: `apps/api/src/db/schema.ts` (nguồn duy nhất).
- Đổi schema: sửa `schema.ts` → `npm run db:generate -- --name <mo_ta>` → review file SQL trong `apps/api/db/migrations/` → `npm run db:migrate`.
- Xem dữ liệu: `npm run db:studio`.
- Đồng bộ dữ liệu từ server cũ (SQLite): `npm run db:import -- <đường-dẫn>/superwhite.db --excel-dir <web/data/excel/files>` (chạy lại được; `--wipe` để làm lại từ đầu).

## Deploy lên Vercel

1. **API**: New Project → import repo → Root Directory `apps/api` → Environment Variables: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `SESSION_SECRET`, `CRON_SECRET` → Deploy.
   Cron sao lưu 23:59 (giờ VN) đã khai báo trong `apps/api/vercel.json`.
2. **Web**: New Project → cùng repo → Root Directory `apps/web` → `API_URL` = URL project API (không có `/` cuối) → Deploy.
3. Chạy migration lên Neon từ máy local: `DATABASE_URL=<neon-url> npm run db:migrate` (trong `apps/api`).
4. Chương trình C# Máy B gửi PLC tới `https://<domain-web>/api/plc/telemetry` (API key giữ nguyên).

Chi tiết: [`docs/MIGRATION_PLAN.md`](docs/MIGRATION_PLAN.md) · Quy ước code: [`docs/PORTING_GUIDE.md`](docs/PORTING_GUIDE.md).
