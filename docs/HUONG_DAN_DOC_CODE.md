# Đọc code cho người mới

Dòng bắt đầu bằng `//` hoặc nằm trong `/* … */` là **chú thích** – máy bỏ qua, chỉ để người đọc hiểu.

## Một cú bấm đi đâu?

```
Bấm nút trên web  →  /api/...  →  máy chủ kiểm tra quyền  →  đọc/ghi dữ liệu  →  trả kết quả  →  màn hình cập nhật
   (app/)                         (server/src/)               (Postgres, Blob)
```

## Thư mục chính

| Thư mục | Là gì |
|---|---|
| `app/` | Các trang web. Mỗi thư mục con = 1 trang (`ke-hoach`, `van-hanh`, `kho`…) |
| `components/` | Mảnh giao diện dùng chung (nút, bảng, hộp thoại) |
| `lib/` | Hàm tiện ích (gọi API, định dạng ngày/số) |
| `public/` | Logo, ảnh sơ đồ máy |
| `server/src/modules/` | Máy chủ: mỗi thư mục = 1 nghiệp vụ (`orders` đơn hàng, `warehouse` kho, `plc`…) |
| `server/src/db/schema.ts` | Danh sách tất cả bảng dữ liệu |

## Muốn sửa…

| Việc | File |
|---|---|
| Nút ở trang Kế hoạch | `app/(app)/ke-hoach/_components/order-actions.tsx` |
| Màu dòng đơn hàng | `app/(app)/ke-hoach/_components/order-list.tsx` |
| Ô số trên sơ đồ máy | `app/(app)/van-hanh/_components/scada-diagram.tsx` |
| Thẻ ở trang chủ | `lib/nav.ts` |
| Quyền với đơn hàng | `server/src/modules/orders/orders.controller.ts` |

## Lệnh

`npm run dev` chạy thử · `npm run typecheck` kiểm lỗi · Đưa lên GitHub: xem [git/README.md](git/README.md)
