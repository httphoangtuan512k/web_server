"use client";

import { PageBody, PageTopbar } from "./page-topbar";
import { PageGuard } from "./page-guard";

export function ComingSoon({ title, page, description }: { title: string; page: string; description: string }) {
  return (
    <PageGuard page={page}>
      <PageTopbar title={title} />
      <PageBody>
        <div className="rounded-xl border border-line bg-surface px-6 py-14 text-center">
          <p className="text-4xl">🚧</p>
          <h2 className="mt-3 text-lg font-bold text-fg">Phân hệ đang được phát triển</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
      </PageBody>
    </PageGuard>
  );
}
