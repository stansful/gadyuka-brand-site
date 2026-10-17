import { Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { LeadActions } from "@/components/admin/leads/LeadActions";
import { LeadStatusBadge, LeadTypeBadge, TelegramBadge } from "@/components/admin/leads/LeadBadges";
import { Card, PageHeader } from "@/components/admin/ui/layout";
import { isLocale, localeNames } from "@/i18n/locales";
import { formatDateTimeRu } from "@/lib/admin/labels";
import { getLeadDetail } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Заявка" };

export default async function LeadPage({ params }: PageProps<"/admin/leads/[id]">): Promise<ReactElement> {
  const { id } = await params;
  const lead = await getLeadDetail(id);
  if (!lead) notFound();
  const language = isLocale(lead.locale) ? localeNames[lead.locale].ru : lead.locale;

  return (
    <>
      <PageHeader
        title={`Заявка от ${lead.name}`}
        backHref="/admin/leads"
        backLabel="Все заявки"
        description={
          <span className="flex flex-wrap items-center gap-2">
            {formatDateTimeRu(lead.createdAt)}
            <LeadTypeBadge type={lead.type} />
            <LeadStatusBadge status={lead.status} />
            <TelegramBadge sent={lead.telegramSent} />
          </span>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Контакты">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">Имя</dt>
              <dd className="font-semibold">{lead.name}</dd>
              <dt className="text-muted">Телефон</dt>
              <dd>
                {lead.phone ? (
                  <a href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-1.5 text-beige hover:underline">
                    <Phone className="size-3.5" aria-hidden />
                    {lead.phone}
                  </a>
                ) : (
                  <span className="text-muted">не указан</span>
                )}
              </dd>
              <dt className="text-muted">E-mail</dt>
              <dd className="break-all">
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-beige hover:underline">
                    <Mail className="size-3.5" aria-hidden />
                    {lead.email}
                  </a>
                ) : (
                  <span className="text-muted">не указан</span>
                )}
              </dd>
              <dt className="text-muted">Язык сайта</dt>
              <dd>{language}</dd>
            </dl>
          </Card>
          <Card title="Сообщение">
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{lead.message || "—"}</p>
          </Card>
          {lead.meta.length > 0 ? (
            <Card title="Дополнительно" description="Служебные данные формы.">
              <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-[auto_1fr]">
                {lead.meta.map((item) => (
                  <div key={item.key} className="contents">
                    <dt className="font-mono text-muted">{item.key}</dt>
                    <dd className="font-mono break-all text-fg/80">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Обработка">
            <LeadActions key={`${lead.id}-${lead.status}`} id={lead.id} status={lead.status} telegramSent={lead.telegramSent} />
          </Card>
          {!lead.telegramSent && lead.telegramError ? (
            <Card title="Ошибка Telegram">
              <p className="text-xs break-words whitespace-pre-wrap text-red-fg">{lead.telegramError}</p>
            </Card>
          ) : null}
          <p className="text-xs text-muted">Обновлено: {formatDateTimeRu(lead.updatedAt)}</p>
        </div>
      </div>
    </>
  );
}
