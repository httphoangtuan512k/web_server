"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";

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
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    api.get<T>(url).then(
      (data) => alive && setState({ url, data, error: "" }),
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
      const error = errorMessage(e);
      setState((s) => ({ ...s, url, error }));
      return error;
    } finally {
      setRefreshing(false);
    }
  }, [url]);

  return {
    data: state.data,
    error: state.url === url ? state.error : "",
    /** Đang tải lần đầu cho `url` hiện tại (hoặc đang làm mới). */
    loading: (!!url && state.url !== url) || refreshing,
    /** Đã có dữ liệu cho đúng `url` hiện tại. */
    ready: !!url && state.url === url && state.data !== null,
    reload,
  };
}
