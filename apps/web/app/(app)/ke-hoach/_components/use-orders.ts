"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { OrdersResponse } from "./types";

/** Chu kỳ tự làm mới danh sách đơn (khi tab đang hiển thị). */
const REFRESH_MS = 30_000;

/**
 * Tải GET /api/orders, tự làm mới định kỳ (dừng khi tab ẩn, tải lại ngay khi quay lại tab).
 * `loadedAt` = thời điểm tải xong gần nhất (ms) – dùng làm "bây giờ" cho bộ lọc lưu trữ 3 tháng.
 */
export function useOrders() {
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const inflight = useRef(false);

  const reload = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setRefreshing(true);
    try {
      const d = await api.get<OrdersResponse>("/api/orders");
      setData({ ...d, orders: Array.isArray(d?.orders) ? d.orders : [], permissions: Array.isArray(d?.permissions) ? d.permissions : [] });
      setError(null);
      setLoadedAt(Date.now());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inflight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(reload, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  return { data, error, loadedAt, refreshing, reload };
}
