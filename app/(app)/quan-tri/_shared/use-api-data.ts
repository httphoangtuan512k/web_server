"use client";
// File này: hook `useApiData` – tải dữ liệu từ máy chủ, nhớ dữ liệu / lỗi / trạng thái đang tải.
// Dùng ở: các trang Quản trị (danh sách người dùng, nhật ký, sao lưu…).

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";

// Bộ nhớ trong hook: dữ liệu và lỗi thuộc về `url` nào.
interface State<T> {
  url: string | null;
  data: T | null;
  error: string;
}

/**
 * Tải dữ liệu GET theo `url` (null = chưa tải). Đổi `url` → tự tải lại, giữ dữ liệu cũ trong lúc chờ.
 *   const { data, error, loading, reload } = useApiData<User[]>('/api/users');
 */
export function useApiData<T>(url: string | null) {
  const [state, setState] = useState<State<T>>({ url: null, data: null, error: "" });
  // true khi đang bấm tải lại.
  const [refreshing, setRefreshing] = useState(false);

  // Mỗi khi `url` đổi: gọi máy chủ lấy dữ liệu.
  useEffect(() => {
    if (!url) return;
    // Bỏ qua kết quả trả về muộn nếu url đã đổi.
    let alive = true;
    api.get<T>(url).then(
      // Thành công: lưu dữ liệu, xóa lỗi.
      (data) => alive && setState({ url, data, error: "" }),
      // Lỗi: giữ dữ liệu cũ, lưu câu báo lỗi.
      (e) => alive && setState((s) => ({ url, data: s.data, error: errorMessage(e) })),
    );
    return () => {
      alive = false;
    };
  }, [url]);

  /** Tải lại; trả về thông báo lỗi ('' nếu thành công). */
  const reload = useCallback(async () => {
    if (!url) return "";
    setRefreshing(true);
    try {
      const data = await api.get<T>(url);
      setState({ url, data, error: "" });
      return "";
    } catch (e) {
      // Lỗi: lưu câu lỗi, giữ dữ liệu cũ.
      const error = errorMessage(e);
      setState((s) => ({ ...s, url, error }));
      return error;
    } finally {
      setRefreshing(false);
    }
  }, [url]);

  return {
    data: state.data,
    // Chỉ báo lỗi của đúng url hiện tại.
    error: state.url === url ? state.error : "",
    /** Đang tải lần đầu cho `url` hiện tại (hoặc đang làm mới). */
    loading: (!!url && state.url !== url) || refreshing,
    /** Đã có dữ liệu cho đúng `url` hiện tại. */
    ready: !!url && state.url === url && state.data !== null,
    reload,
  };
}
