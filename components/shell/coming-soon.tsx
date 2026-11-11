"use client";
/**
 * File này: màn hình "Phân hệ đang được phát triển" 🚧 cho chức năng chưa làm.
 * Dùng ở: trang KCS và Xuất hàng. ("use client" = chạy trên trình duyệt.)
 */

import { PageBody, PageTopbar } from "./page-topbar";
import { PageGuard } from "./page-guard";

/** Thanh tiêu đề + khung báo "đang phát triển"; `page` là mã quyền để kiểm tra. */
export function ComingSoon({ title, page, description }: { title: string; page: string; description: string }) {
  return (
    // Chỉ người có quyền trang mới thấy nội dung.
    <PageGuard page={page}>
      {/* Thanh tiêu đề (có nút "← Trang chủ"). */}
      <PageTopbar title={title} />
      <PageBody>
        {/* Khung trắng bo góc, chữ giữa: 🚧 + tiêu đề + mô tả. */}
        <div className="rounded-xl border border-line bg-surface px-6 py-14 text-center">
          <p className="text-4xl">🚧</p>
          <h2 className="mt-3 text-lg font-bold text-fg">Phân hệ đang được phát triển</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
      </PageBody>
    </PageGuard>
  );
}
