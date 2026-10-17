import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { LeadStatusBadge, LeadTypeBadge, TelegramBadge } from "@/components/admin/leads/LeadBadges";
import { LeadFilters } from "@/components/admin/leads/LeadFilters";
import { buttonClasses } from "@/components/admin/ui/Button";
import { EmptyState, PageHeader } from "@/components/admin/ui/layout";
import type { LeadStatus, LeadType } from "@/generated/prisma/enums";
import { countRu, formatDateTimeRu, LEAD_STATUSES, LEAD_TYPES } from "@/lib/admin/labels";
import { listLeadsAdmin } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Заявки" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseType(value: string | undefined): LeadType | null {
  return LEAD_TYPES.find((type) => type === value) ?? null;
}

function parseStatus(value: string | undefined): LeadStatus | null {
  return LEAD_STATUSES.find((status) => status === value) ?? null;
}

function pageHref(params: { type: LeadType | null; status: LeadStatus | null; page: number }): string {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.status) query.set("status", params.status);
  if (params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `/admin/leads?${text}` : "/admin/leads";
}

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">): Promise<ReactElement> {
  const params = await searchParams;
  const type = parseType(first(params.type));
  const status = parseStatus(first(params.status));
  const requestedPage = Number.parseInt(first(params.page) ?? "1", 10);
  const result = await listLeadsAdmin({ type, status, page: Number.isFinite(requestedPage) ? requestedPage : 1 });
  const filtered = type !== null || status !== null;

  return (
    <>
      <PageHeader
        title="Заявки"
        description="Заявки с форм сайта: пошив, сотрудничество, «Связаться». Каждая также уходит в Telegram."
      />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <LeadFilters type={type} status={status} />
        <p className="text-xs text-muted">{countRu(result.total, "заявка", "заявки", "заявок")}</p>
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<Inbox aria-hidden />}
          title={filtered ? "Нет заявок с такими фильтрами" : "Заявок пока нет"}
          description={filtered ? "Измените или сбросьте фильтры." : "Они появятся здесь, когда посетители заполнят формы на сайте."}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Список заявок</caption>
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Дата</th>
                <th scope="col" className="px-4 py-3 font-medium">Тип</th>
                <th scope="col" className="px-4 py-3 font-medium">Имя и контакты</th>
                <th scope="col" className="px-4 py-3 font-medium">Сообщение</th>
                <th scope="col" className="px-4 py-3 font-medium">Статус</th>
                <th scope="col" className="px-4 py-3 font-medium">Telegram</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.items.map((lead) => (
                <tr key={lead.id} className="align-top transition-colors hover:bg-raised">
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-muted">
                    <Link href={`/admin/leads/${lead.id}`} className="hover:text-beige">
                      {formatDateTimeRu(lead.createdAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <LeadTypeBadge type={lead.type} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/leads/${lead.id}`} className="font-semibold hover:text-beige">
                      {lead.name}
                    </Link>
                    <div className="mt-0.5 flex flex-col text-xs text-muted">
                      {lead.phone ? <span>{lead.phone}</span> : null}
                      {lead.email ? <span className="break-all">{lead.email}</span> : null}
                    </div>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-fg/80">
                    <Link href={`/admin/leads/${lead.id}`} className="line-clamp-2 hover:text-fg">
                      {lead.preview || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3">
                    <TelegramBadge sent={lead.telegramSent} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Страницы" className="mt-5 flex items-center justify-between gap-3">
          {result.page > 1 ? (
            <Link href={pageHref({ type, status, page: result.page - 1 })} className={buttonClasses("outline", "sm")}>
              <ChevronLeft className="size-4" aria-hidden />
              Назад
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted">
            Страница {result.page} из {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link href={pageHref({ type, status, page: result.page + 1 })} className={buttonClasses("outline", "sm")}>
              Дальше
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
