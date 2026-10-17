"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ReactElement } from "react";
import type { LeadStatus, LeadType } from "@/generated/prisma/enums";
import { LEAD_STATUS_LABELS, LEAD_STATUSES, LEAD_TYPE_LABELS, LEAD_TYPES } from "@/lib/admin/labels";
import { Select } from "../ui/inputs";

/** Type / status filters (URL search params, so the filtered list can be bookmarked). */
export function LeadFilters({ type, status }: { type: LeadType | null; status: LeadStatus | null }): ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const apply = (next: { type: string; status: string }): void => {
    const params = new URLSearchParams();
    if (next.type) params.set("type", next.type);
    if (next.status) params.set("status", next.status);
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  };

  return (
    <div className="flex flex-wrap items-end gap-3" aria-busy={pending || undefined}>
      <div className="flex flex-col gap-1">
        <label htmlFor="lead-filter-type" className="text-xs text-muted">
          Тип
        </label>
        <Select id="lead-filter-type" value={type ?? ""} onChange={(event) => apply({ type: event.target.value, status: status ?? "" })} className="w-56">
          <option value="">Все типы</option>
          {LEAD_TYPES.map((value) => (
            <option key={value} value={value}>
              {LEAD_TYPE_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="lead-filter-status" className="text-xs text-muted">
          Статус
        </label>
        <Select id="lead-filter-status" value={status ?? ""} onChange={(event) => apply({ type: type ?? "", status: event.target.value })} className="w-44">
          <option value="">Все статусы</option>
          {LEAD_STATUSES.map((value) => (
            <option key={value} value={value}>
              {LEAD_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
      {type || status ? (
        <button type="button" onClick={() => apply({ type: "", status: "" })} className="h-10 px-2 text-xs text-muted hover:text-fg">
          Сбросить
        </button>
      ) : null}
      {pending ? <span className="h-10 text-xs leading-10 text-muted">Загрузка…</span> : null}
    </div>
  );
}
