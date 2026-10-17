import { Send, TriangleAlert } from "lucide-react";
import type { ReactElement } from "react";
import type { LeadStatus, LeadType } from "@/generated/prisma/enums";
import { LEAD_STATUS_LABELS, LEAD_TYPE_LABELS } from "@/lib/admin/labels";
import { Badge, type BadgeTone } from "../ui/layout";

const statusTones: Record<LeadStatus, BadgeTone> = {
  NEW: "beige",
  IN_PROGRESS: "blue",
  DONE: "neutral",
  SPAM: "red",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }): ReactElement {
  return <Badge tone={statusTones[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
}

export function LeadTypeBadge({ type }: { type: LeadType }): ReactElement {
  return <Badge tone="outline">{LEAD_TYPE_LABELS[type]}</Badge>;
}

export function TelegramBadge({ sent }: { sent: boolean }): ReactElement {
  return sent ? (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted" title="Отправлено в Telegram">
      <Send className="size-3.5" aria-hidden />
      <span className="sr-only">Отправлено в Telegram</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-fg" title="Не доставлено в Telegram">
      <TriangleAlert className="size-3.5" aria-hidden />
      не доставлено
    </span>
  );
}
