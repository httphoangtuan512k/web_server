# Hướng dẫn giao diện: hiện đại nhưng giữ nút & hình như bản gốc

Yêu cầu của chủ dự án:
1. **Giao diện hiện đại**: bố cục gọn gàng, thẻ bo góc, đổ bóng nhẹ, khoảng cách thoáng, font Be Vietnam Pro, tương tác mượt.
2. **Nút bấm & hình ảnh giống bản gốc**: cùng **chữ trên nút** (kể cả ký tự/emoji như `👁 Xem`, `⏸ Tạm dừng`, `▶ Chạy thêm máy`, `✔ Xác nhận xong`, `+ Tạo đơn`, `↓ Xuất Excel`, `← Trang chủ`, `📊 Dữ liệu PLC`), cùng **màu nút**, cùng **vị trí/thứ tự**, cùng **màu khối trạng thái**, cùng **ảnh** (logo, ảnh sơ đồ máy SCADA, ảnh đơn hàng). Người dùng quen tay phải nhận ra ngay.
3. **Xem được trên mọi màn hình** (điện thoại 360px → màn hình xưởng 4K): không tràn ngang trang; bảng rộng cuộn ngang trong khung riêng hoặc chuyển dạng thẻ; ảnh sơ đồ co giãn theo khung, số liệu đè lên ảnh đặt bằng **% (left/top) + `transform: translate(-50%,-50%)`** trong khung có `aspect-ratio` cố định, cỡ chữ dùng `clamp()`/container units (`cqw`) để luôn khớp vị trí trên ảnh.

## Tham chiếu bản gốc

- Ảnh chụp bản gốc: `/tmp/sw_e2e/old/d_<trang>.png` (máy tính 1440px) và `m_<trang>.png` (điện thoại 390px).
- Bản gốc đang chạy để so sánh trực tiếp: http://localhost:3900 – tài khoản `ref_admin` / `RefAdmin#2026` (bản sao, không phải dữ liệu thật). Đường dẫn: `/trangchu.html`, `/kehoach.html`, `/vanhanh.html`, `/dataplc.html`, `/kho.html`, `/baotri.html`, `/admin.html`, `/log.html`, `/superdata.html`, `/quanlytailieu.html`.
- Mã nguồn bản gốc (chỉ đọc): `/Users/nvt/CODE/CV/CODE TUẤN/web/` – lấy **chính xác** mã màu, chữ trên nút, thứ tự cột, ảnh base64 từ đây.
- Ứng dụng mới đang chạy (dev, tự cập nhật khi sửa code): http://localhost:3700 – tài khoản `dev_admin` / `DevAdmin#2026`.
- Chụp màn hình để tự kiểm tra: dùng `playwright-core` có sẵn trong `/tmp/sw_e2e` (Chrome: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`), xem mẫu `/tmp/sw_e2e/shot.js`. Luôn chụp cả 1440px và 390px, so với ảnh bản gốc.

## Khung trang (đã có sẵn – dùng, không sửa)

- Không còn sidebar. Mỗi trang:
  ```tsx
  <PageGuard page="kehoach">
    <PageTopbar title="Kế hoạch sản xuất" color="#173e66" actions={…} />   {/* "← Trang chủ" tự có */}
    <PageBody>…nội dung…</PageBody>
  </PageGuard>
  ```
  `@/components/shell/page-topbar` có `PageTopbar`, `TopbarLink`, `TopbarButton`, `PageBody`. Màu thanh tiêu đề lấy từ trang gốc
  (kế hoạch `#173e66`, vận hành/PLC `#1e3a8a`, kho gradient `#12345a→#1f5688` (truyền `color="linear-gradient(115deg,#12345a,#1f5688)"`), bảo trì/quản trị/tài liệu `#172b3a`).
- Trang chủ (`app/(app)/home-parts/dashboard.tsx`) và đăng nhập (`app/login/*`) đã làm xong theo hướng này – tham khảo phong cách.
- Không còn dark mode – không dùng `dark:`.
- Component trong `@/components/ui/*` vẫn dùng được cho phần khung hiện đại (Card, Modal, Table, Toast, Confirm, Field/Input…).
  **Nút hành động chính phải theo màu/chữ bản gốc**: có thể dùng `<button>` với class Tailwind mã màu gốc (vd `bg-[#ea580c]`) thay cho `Button` variant.

## Giữ nguyên logic

Chức năng, gọi API, quyền đã đúng trong code hiện tại – **chỉ đổi phần hiển thị**. Không đổi hợp đồng API, không xóa chức năng mới đã có (lịch sử, in, tự làm mới…) – nếu bản gốc không có thì đặt ở vị trí hợp lý, không lấn át các nút gốc.
Quy ước màu dòng trang Kế hoạch đã chốt với chủ dự án: **trắng = chưa chạy, vàng = đang chạy/tạm dừng, xanh lá = đã chạy xong**.
