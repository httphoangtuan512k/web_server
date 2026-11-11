import { cn } from "@/lib/cn";

/**
 * Bảng dữ liệu responsive (cuộn ngang trên mobile, header dính).
 *   <Table><THead><tr><Th>…</Th></tr></THead><tbody><Tr><Td>…</Td></Tr></tbody></Table>
 */
export function Table({ className, children, maxHeight }: { className?: string; children: React.ReactNode; maxHeight?: string }) {
  return (
    <div className={cn("w-full overflow-auto", className)} style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full min-w-max border-separate border-spacing-0 text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="sticky top-0 z-[1] bg-surface-2">{children}</thead>;
}

export function Th({ className, children, align, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "border-b border-line px-3 py-2.5 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-muted uppercase first:pl-5 last:pr-5",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Tr({ className, children, ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("transition-colors hover:bg-surface-2 [&:last-child>td]:border-b-0", rest.onClick && "cursor-pointer", className)} {...rest}>
      {children}
    </tr>
  );
}

export function Td({ className, children, align, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "border-b border-line px-3 py-2.5 align-middle text-fg first:pl-5 last:pr-5",
        align === "right" && "num text-right",
        align === "center" && "text-center",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
