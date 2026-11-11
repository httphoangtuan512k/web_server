"use client";

import { useEffect, useEffectEvent, useState } from "react";

/**
 * Gọi `fn` ngay khi mount và lặp lại mỗi `intervalMs`.
 * Dừng khi tab ẩn, chạy lại ngay khi tab hiện; không gọi chồng khi lần trước chưa xong.
 */
export function usePolling(fn: () => unknown, intervalMs: number, enabled = true) {
  const tick = useEffectEvent(fn);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let busy = false;
    let alive = true;

    const run = async () => {
      if (busy || !alive) return;
      busy = true;
      try {
        await tick();
      } finally {
        busy = false;
      }
    };
    const start = () => {
      if (timer) return;
      void run();
      timer = setInterval(() => void run(), intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? stop() : start());

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled]);
}

/** Bộ đếm tăng mỗi `ms` để vẽ lại nhãn thời gian tương đối ("5 giây trước"). */
export function useTick(ms = 1000) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}
