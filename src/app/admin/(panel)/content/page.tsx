import { clsx } from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { ContentSectionForm } from "@/components/admin/forms/ContentSectionForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { getContentSection, getContentTranslationGaps } from "@/lib/admin/queries";
import { sectionIdSchema } from "@/lib/admin/schemas";
import { CONTENT_SECTIONS, type SectionId } from "@/lib/content/registry";

export const metadata: Metadata = { title: "Контент" };

function pickSection(value: string | string[] | undefined): SectionId {
  const parsed = sectionIdSchema.safeParse(Array.isArray(value) ? value[0] : value);
  return parsed.success ? parsed.data : "hero";
}

export default async function ContentPage({ searchParams }: PageProps<"/admin/content">): Promise<ReactElement> {
  const section = pickSection((await searchParams).section);
  const [data, gaps] = await Promise.all([getContentSection(section), getContentTranslationGaps()]);

  return (
    <>
      <PageHeader
        title="Контент"
        description="Тексты и картинки секций лендинга. Выберите раздел, отредактируйте поля на каждом языке и сохраните — сайт обновится сразу."
      />
      <nav aria-label="Разделы сайта" className="mb-6 -mx-1 overflow-x-auto pb-1">
        <ul className="flex min-w-max gap-1 px-1">
          {CONTENT_SECTIONS.map((item) => {
            const active = item.id === section;
            const gap = gaps[item.id] ?? 0;
            return (
              <li key={item.id}>
                <Link
                  href={`/admin/content?section=${item.id}`}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm whitespace-nowrap transition-colors",
                    active ? "border-blue bg-blue font-semibold text-fg" : "border-line text-fg/70 hover:border-line-strong hover:text-fg",
                  )}
                >
                  {item.label}
                  {gap > 0 ? (
                    <span className="rounded-full bg-beige/20 px-1.5 text-[10px] text-beige" title={`Без перевода: ${gap}`}>
                      {gap}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <ContentSectionForm data={data} />
    </>
  );
}
