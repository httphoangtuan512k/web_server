"use client";
// File này: hook gọi một hàm định kỳ, chỉ khi tab trình duyệt đang mở xem (tự làm mới dữ liệu).
// Dùng ở: các bảng tự làm mới trong trang Quản trị.

import { useEffect, useRef } from "react";

/** Gọi `fn` định kỳ khi tab đang hiển thị; tự gọi lại ngay khi người dùng quay lại tab. */
export function useVisibleInterval(fn: () => void, ms: number, enabled = true) {
  // Luôn giữ bản mới nhất của `fn` để đồng hồ gọi đúng.
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!enabled) return;
    // Mỗi `ms` mili-giây: gọi hàm nếu tab đang hiện.
    const tick = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    const id = window.setInterval(tick, ms);
    // Người dùng quay lại tab → gọi ngay.
    const onVis = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    document.addEventListener("visibilitychange", onVis);
    // Dọn dẹp: hủy đồng hồ và bỏ lắng nghe.
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, enabled]);
}
