"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PageGuard } from "@/components/shell/page-guard";
import { PageBody, PageTopbar } from "@/components/shell/page-topbar";
import { OgButton, OgEmptyBox, OgScreen, topbarStack } from "../../_shared/og-button";
import { useApiData } from "../../_shared/use-api-data";
import { DataGrid } from "./data-grid";
import { RowEditorModal } from "./row-editor-modal";
import type { SuperRow, SuperTable, SuperTableData } from "./types";

/** Thẻ trắng theo superdata.html (viền #e5eaf1, bo 13px). */
const card = "min-w-0 rounded-[13px] border border-[#e5eaf1] bg-white p-4 shadow-[0_3px_12px_rgba(11,27,53,0.03)]";

export function SuperDataPage() {
  return (
    <OgScreen>
      <PageGuard role="super">
        <SuperDataContent />
      </PageGuard>
    </OgScreen>
  );
}

function SuperDataContent() {
  const toast = useToast();
  const confirm = useConfirm();
  const tablesQ = useApiData<SuperTable[]>("/api/super-data/tables");
  const tables = tablesQ.data;
  const [selected, setSelected] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<SuperRow | null>(null);

  // Tìm kiếm phía server, trễ 250 ms như trang cũ.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const table = selected || tables?.[0]?.name || "";
  const url = table ? `/api/super-data/${encodeURIComponent(table)}?q=${encodeURIComponent(query)}` : null;
  const { data, error, loading, ready, reload } = useApiData<SuperTableData>(url);
  const current = data && data.table === table ? data : null;
  const tableLabel = tables?.find((t) => t.name === table)?.label ?? table;

  const refresh = async () => {
    const err = await reload();
    if (err) toast.error(err);
  };

  async function remove(row: SuperRow) {
    if (!current) return;
    const ok = await confirm({
      title: `Xóa bản ghi này khỏi “${current.label}”?`,
      message: (
        <>
          <p>Thao tác có thể ảnh hưởng dữ liệu liên quan và không có chức năng hoàn tác.</p>
          <p className="mt-2 rounded-lg bg-surface-3 px-2.5 py-1.5 font-mono text-xs break-all text-fg">{JSON.stringify(row.key)}</p>
        </>
      ),
      confirmText: "Xóa vĩnh viễn",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/api/super-data/${encodeURIComponent(current.table)}`, { key: row.key });
      toast.success("Đã xóa bản ghi.");
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <PageTopbar
        className={topbarStack}
        title={
          <>
            SUPER WHITE <span className="font-medium text-white/65">/ QUẢN TRỊ DỮ LIỆU</span>
          </>
        }
        subtitle="Chỉnh sửa trực tiếp dữ liệu nghiệp vụ trong cơ sở dữ liệu"
      />

      <PageBody className="max-w-[1500px]! text-[#172033]">
        <div className="mb-3.5 rounded-[9px] border border-[#f5dfac] bg-[#fff8e8] px-3 py-2.5 text-[13px] leading-relaxed text-[#805b16]">
          Chỉ Super Admin truy cập được. Sửa hoặc xóa tại đây tác động trực tiếp đến dữ liệu đang sử dụng (không qua kiểm tra nghiệp vụ, không ghi lịch sử).
          Mật khẩu và cờ định danh Super Admin được bảo vệ, không hiển thị trong bảng này.
        </div>

        <div className="grid gap-4 min-[850px]:grid-cols-[250px_minmax(0,1fr)]">
          {/* Danh mục bảng */}
          <aside className={cn(card, "min-[850px]:sticky min-[850px]:top-20 min-[850px]:self-start")}>
            <h3 className="mb-3 text-lg font-bold">Danh mục dữ liệu</h3>
            {tablesQ.error && !tables ? (
              <p className="py-4 text-sm text-[#b42318]">{tablesQ.error}</p>
            ) : !tables ? (
              <p className="py-4 text-sm text-[#64748b]">Đang tải...</p>
            ) : !tables.length ? (
              <p className="py-4 text-sm text-[#64748b]">Không có bảng nào được phép truy cập.</p>
            ) : (
              <nav className="grid grid-cols-2 gap-1.5 min-[850px]:max-h-[calc(100dvh-240px)] min-[850px]:grid-cols-1 min-[850px]:overflow-y-auto">
                {tables.map((t) => {
                  const active = t.name === table;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      title={t.name}
                      onClick={() => setSelected(t.name)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "min-w-0 truncate rounded-lg px-3 py-[11px] text-left text-[13px] transition-colors sm:text-sm",
                        active ? "bg-[#e8efff] font-bold text-[#1746a2]" : "bg-[#f5f7fb] text-[#334155] hover:bg-[#edf1f8]",
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </nav>
            )}
          </aside>

          {/* Dữ liệu bảng */}
          <section className={card}>
            <h2 className="text-xl font-bold sm:text-2xl">{current?.label ?? tableLabel ?? "Chọn danh mục"}</h2>
            <p className="mt-1.5 text-[13px] text-[#64748b]">
              {current
                ? `Bảng: ${current.table} · Khóa chính: ${current.primaryKey.join(", ")} · ${current.columns.length} cột`
                : "Chọn một bảng ở bên trái để xem và chỉnh sửa bản ghi."}
            </p>

            <div className="my-3 flex flex-wrap items-center gap-2">
              <input
                type="search"
                className="min-w-0 flex-1 rounded-lg border border-[#cbd5e1] bg-white px-[11px] py-2.5 text-sm placeholder:text-[#94a3b8] focus:border-[#9bb8f0] focus:ring-3 focus:ring-[#9bb8f0]/35 focus:outline-none sm:max-w-sm sm:min-w-[180px]"
                placeholder="Tìm trong dữ liệu đang chọn..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <OgButton variant="soft" className="rounded-lg!" loading={loading} onClick={refresh} disabled={!url}>
                Tải lại
              </OgButton>
              {current ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-[3px] text-[11px]",
                    current.rows.length >= 200 ? "bg-[#fff7e6] text-[#92400e]" : "bg-[#eef2f7] text-[#475569]",
                  )}
                >
                  {current.rows.length} bản ghi{current.rows.length >= 200 ? " (giới hạn)" : ""}
                </span>
              ) : null}
              <span className="hidden text-xs text-[#64748b] md:ml-auto md:inline">Nhấp đúp vào ô để sửa</span>
            </div>

            {!table ? (
              <OgEmptyBox>{tables && !tables.length ? "Không có bảng nào được phép truy cập." : "Đang tải..."}</OgEmptyBox>
            ) : error && !ready ? (
              <OgEmptyBox tone="error">{error}</OgEmptyBox>
            ) : !current ? (
              <OgEmptyBox>Đang tải...</OgEmptyBox>
            ) : !current.rows.length ? (
              <OgEmptyBox>{query ? `Không có dữ liệu phù hợp với “${query}”.` : "Không có dữ liệu phù hợp."}</OgEmptyBox>
            ) : (
              <div className={cn("transition-opacity", loading && "opacity-60")}>
                <DataGrid data={current} onEdit={setEditing} onDelete={remove} />
              </div>
            )}
            <p className="mt-2.5 text-[13px] text-[#64748b]">Mỗi lần tải tối đa 200 bản ghi (có thể lọc theo từ khóa).</p>
          </section>
        </div>
      </PageBody>

      {editing && current ? (
        <RowEditorModal key={JSON.stringify(editing.key)} data={current} row={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      ) : null}
    </>
  );
}
