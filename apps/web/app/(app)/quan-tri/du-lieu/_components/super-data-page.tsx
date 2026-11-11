"use client";

import { Database, RefreshCw, SearchX, Table2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "@/components/ui/card";
import { SearchInput, Select } from "@/components/ui/form";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PageGuard } from "@/components/shell/page-guard";
import { Callout } from "../../_shared/callout";
import { useApiData } from "../../_shared/use-api-data";
import { DataGrid } from "./data-grid";
import { RowEditorModal } from "./row-editor-modal";
import type { SuperRow, SuperTable, SuperTableData } from "./types";

export function SuperDataPage() {
  return (
    <PageGuard role="super">
      <SuperDataContent />
    </PageGuard>
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
      title: `Xóa bản ghi khỏi “${current.label}”?`,
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
      <PageHeader title="Dữ liệu gốc" description="Xem và chỉnh sửa trực tiếp các bảng dữ liệu nghiệp vụ. Chỉ Super Admin truy cập được." />
      <Callout tone="danger" title="Bạn đang chỉnh trực tiếp dữ liệu gốc" className="mb-5">
        Sửa hoặc xóa tại đây tác động ngay đến dữ liệu đang sử dụng, bỏ qua mọi kiểm tra nghiệp vụ và không ghi lịch sử. Mật khẩu, khóa phiên và cờ Super Admin được
        bảo vệ, không hiển thị trong trình xem này.
      </Callout>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Danh mục bảng */}
        <aside className="min-w-0">
          <div className="lg:hidden">
            <Select value={table} onChange={(e) => setSelected(e.target.value)} aria-label="Chọn danh mục dữ liệu" disabled={!tables?.length}>
              {!tables ? <option>Đang tải…</option> : null}
              {tables?.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <Card className="hidden overflow-hidden lg:sticky lg:top-4 lg:block">
            <p className="border-b border-line px-4 py-3 text-xs font-semibold tracking-wide text-muted uppercase">Danh mục dữ liệu</p>
            {tablesQ.error && !tables ? (
              <p className="px-4 py-6 text-sm text-danger-600">{tablesQ.error}</p>
            ) : !tables ? (
              <Spinner />
            ) : (
              <nav className="flex max-h-[calc(100dvh-220px)] flex-col gap-0.5 overflow-y-auto p-2">
                {tables.map((t) => {
                  const active = t.name === table;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setSelected(t.name)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                        active ? "bg-brand-50 font-semibold text-brand-700" : "text-muted hover:bg-surface-3 hover:text-fg",
                      )}
                    >
                      <Table2 size={15} className={cn("shrink-0", active ? "text-brand-600" : "text-subtle")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{t.label}</span>
                        <span className="block truncate font-mono text-[10.5px] font-normal text-subtle">{t.name}</span>
                      </span>
                    </button>
                  );
                })}
              </nav>
            )}
          </Card>
        </aside>

        {/* Dữ liệu bảng */}
        <Card className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-fg">{current?.label ?? tableLabel ?? "Chọn danh mục"}</h2>
              <p className="mt-0.5 text-[13px] text-muted">
                {current ? (
                  <>
                    Bảng <code className="font-mono text-xs text-fg">{current.table}</code> · Khóa chính{" "}
                    <code className="font-mono text-xs text-fg">{current.primaryKey.join(", ")}</code> · {current.columns.length} cột
                  </>
                ) : (
                  "Chọn một bảng để xem và chỉnh sửa bản ghi."
                )}
              </p>
            </div>
            {current ? (
              <Badge tone={current.rows.length >= 200 ? "warning" : "neutral"}>
                <span className="num">{current.rows.length}</span> bản ghi{current.rows.length >= 200 ? " (giới hạn)" : ""}
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <SearchInput className="sm:max-w-md sm:flex-1" placeholder="Tìm trong dữ liệu đang chọn…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={refresh} disabled={!url}>
              Tải lại
            </Button>
            <p className="text-xs text-muted sm:ml-auto">Nhấp đúp vào ô để sửa · tối đa 200 bản ghi mỗi lần tải</p>
          </div>

          {!table ? (
            tables && !tables.length ? <EmptyState icon={Database} title="Không có bảng nào được phép truy cập" /> : <Spinner />
          ) : error && !ready ? (
            <EmptyState icon={SearchX} title="Không đọc được dữ liệu" description={error} action={<Button variant="secondary" icon={RefreshCw} onClick={refresh}>Thử lại</Button>} />
          ) : !current ? (
            <Spinner />
          ) : !current.rows.length ? (
            <EmptyState icon={SearchX} title="Không có dữ liệu phù hợp" description={query ? `Không tìm thấy “${query}”.` : "Bảng chưa có bản ghi nào."} />
          ) : (
            <div className={cn("transition-opacity", loading && "opacity-60")}>
              <DataGrid data={current} onEdit={setEditing} onDelete={remove} />
            </div>
          )}
        </Card>
      </div>

      {editing && current ? (
        <RowEditorModal key={JSON.stringify(editing.key)} data={current} row={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      ) : null}
    </>
  );
}
