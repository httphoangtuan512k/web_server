"use client";
/**
 * File này: khung trang Quản lý kho – thanh tiêu đề, 5 tab, nội dung tab đang chọn.
 * Dùng ở: trang /kho. Tải dữ liệu kho một lần rồi chia cho từng tab.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { todayKey } from "@/lib/format";
import { PageGuard } from "@/components/shell/page-guard";
import { PageBody, PageTopbar } from "@/components/shell/page-topbar";
import { Spinner } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { DailyTab } from "./daily-tab";
import { ItemsTab } from "./items-tab";
import { KBtn, KCard } from "./kho-ui";
import { TransactionsTab } from "./transactions-tab";
import type { WarehouseData } from "./types";
// Mã của 5 tab.

type TabKey = "daily" | "goods" | "packaging" | "materials" | "transactions";
// Thứ tự và chữ trên các nút tab.

/** Thứ tự & chữ các tab giống kho.html cũ. */
const TABS: Array<{ value: TabKey; label: string }> = [
  { value: "daily", label: "Tổng hợp cuối ngày" },
  { value: "goods", label: "Hàng hóa" },
  { value: "packaging", label: "Bao bì" },
  { value: "materials", label: "Vật tư" },
  { value: "transactions", label: "Lịch sử nhập / xuất" },
];

// Trang kho: chỉ hiện khi người dùng có quyền xem "kho".
export function KhoPage() {
  return (
    <PageGuard page="kho">
      <Warehouse />
    </PageGuard>
  );
}

// Nội dung trang kho: tiêu đề, hàng tab, tab đang mở.
function Warehouse() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  // Dữ liệu kho (null = chưa tải xong) và câu lỗi.
  const [data, setData] = useState<WarehouseData | null>(null);
  const [error, setError] = useState("");
  // Tab đang mở và ngày đang xem.
  const [tab, setTab] = useState<TabKey>("daily");
  const [workDate, setWorkDate] = useState(() => todayKey());
  // Đang chạy sao lưu (để nút hiện vòng xoay).
  const [backingUp, setBackingUp] = useState(false);

  // Tải lại dữ liệu kho (nút "Thử lại", sau khi lưu/xóa).
  const reload = useCallback(async () => {
    try {
      const d = await api.get<WarehouseData>("/api/warehouse");
      setData(d);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  // Mở trang lần đầu: tải dữ liệu kho.
  useEffect(() => {
    // alive = false khi đã rời trang → bỏ qua kết quả trả về muộn.
    let alive = true;
    api
      .get<WarehouseData>("/api/warehouse")
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, []);

  // Quyền sửa: kho_edit (admin/super luôn có) và server cũng phải xác nhận canEdit.
  const canEdit = can("kho_edit") && (data ? data.canEdit !== false : false);

  // Nút "Sao lưu ngay" (Super Admin): hỏi xác nhận → gọi API sao lưu → báo kết quả.
  async function backupNow() {
    if (!(await confirm({ title: "Sao lưu ngay?", message: "Tạo bản sao lưu đầy đủ dữ liệu hệ thống ngay bây giờ." }))) return;
    setBackingUp(true);
    try {
      const r = await api.post<{ ok?: boolean; name?: string; pathname?: string }>("/api/superadmin/backups");
      toast.success(`Sao lưu thành công${r?.name || r?.pathname ? `: ${r.name || r.pathname}` : "."}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBackingUp(false);
    }
  }

  // Mở một ngày đã chốt: chuyển về tab tổng hợp và cuộn lên đầu.
  const openDate = (date: string) => {
    setWorkDate(date);
    setTab("daily");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Số mặt hàng hiện cạnh tên tab Hàng hóa/Bao bì/Vật tư.
  const count = (k: TabKey) => (data && (k === "goods" || k === "packaging" || k === "materials") ? data[k].length : null);

  return (
    <div className="min-h-dvh bg-[#f4f7fb] text-sm text-[#1d2939]">
      {/* Thanh tiêu đề xanh navy: "SUPER WHITE / QUẢN LÝ KHO" + nút "← Trang chủ". */}
      <PageTopbar
        color="linear-gradient(115deg,#12345a,#1f5688)"
        title={
          <>
            SUPER WHITE <span className="block text-xs font-medium tracking-[1px] text-[#c9ddf2] sm:inline sm:text-sm">/ QUẢN LÝ KHO</span>
          </>
        }
        subtitle={
          <>
            <span className="block truncate text-[#d7e5f3]">Theo dõi sản lượng, tồn kho hàng hóa, bao bì và vật tư</span>
            {/* Báo người dùng đang có quyền sửa hay chỉ xem. */}
            {data ? (
              <span className="block truncate text-[#d7e5f3]">
                {canEdit ? "Bạn có quyền chỉnh sửa dữ liệu Kho." : "Chế độ chỉ xem: tài khoản này chưa được cấp quyền chỉnh sửa Kho."}
              </span>
            ) : null}
          </>
        }
        backHref={null}
        actions={
          <Link
            href="/"
            className="inline-flex min-h-9 items-center justify-center rounded-[9px] bg-white px-[15px] py-2 text-sm font-bold whitespace-nowrap text-[#12345a] shadow-sm transition hover:-translate-y-px hover:bg-[#eef3f8]"
          >
            ← Trang chủ
          </Link>
        }
      />

      <PageBody>
        {/* Hàng nút tab. */}
        <nav
          role="tablist"
          aria-label="Chức năng kho"
          className="mb-[18px] flex flex-wrap gap-1.5 rounded-xl border border-[#e0e8f1] bg-[#eaf0f7] p-[7px] sm:gap-2"
        >
          {TABS.map((t) => {
            const active = tab === t.value;
            const n = count(t.value);
            // Nút tab: tab đang chọn có nền trắng; bấm để đổi tab.
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-[11px] py-[9px] text-[13px] font-bold whitespace-nowrap transition sm:px-[17px] sm:py-[11px] sm:text-sm",
                  active
                    ? "border-[#dce6f1] bg-white text-[#12345a] shadow-[0_2px_7px_#173c6412]"
                    : "border-transparent text-[#43556d] hover:bg-white/60 hover:text-[#12345a]",
                )}
              >
                {t.label}
                {/* Số mặt hàng trong tab. */}
                {n !== null ? (
                  <span className={cn("rounded-full px-1.5 text-[11px] font-semibold tabular-nums", active ? "bg-[#edf5fd] text-[#2867a5]" : "bg-white/70 text-[#66758a]")}>
                    {n}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Chưa có dữ liệu: lỗi → nút "Thử lại", đang tải → vòng xoay. Có rồi → hiện tab. */}
        {!data ? (
          error ? (
            <KCard className="text-center">
              <p className="text-sm text-[#c24141]">{error}</p>
              <KBtn variant="secondary" className="mt-4" onClick={reload}>
                Thử lại
              </KBtn>
            </KCard>
          ) : (
            <Spinner />
          )
        ) : (
          <>
            {/* Tab "Tổng hợp cuối ngày" (nhập sản lượng, chốt ngày). */}
            {tab === "daily" ? (
              <DailyTab
                date={workDate}
                onDateChange={setWorkDate}
                canEdit={canEdit}
                closingDates={data.closingDates}
                onClosed={reload}
                onOpenDate={openDate}
                backup={data.isSuper ? { run: backupNow, loading: backingUp } : undefined}
              />
            ) : null}
            {/* Tab Hàng hóa / Bao bì / Vật tư (cùng một component). */}
            {tab === "goods" || tab === "packaging" || tab === "materials" ? (
              <ItemsTab key={tab} category={tab} items={data[tab]} canEdit={canEdit} onChanged={reload} />
            ) : null}
            {/* Tab "Lịch sử nhập / xuất". */}
            {tab === "transactions" ? <TransactionsTab data={data} canEdit={canEdit} onChanged={reload} /> : null}
          </>
        )}
      </PageBody>
    </div>
  );
}
