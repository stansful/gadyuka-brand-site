"use client";

import { ExternalLink, Save, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition, type ReactElement, type ReactNode } from "react";
import { toast } from "sonner";
import type { Locale } from "@/i18n/locales";
import { deleteItem } from "@/lib/admin/actions/entities";
import type { PublishableEntity } from "@/lib/admin/schemas";
import { LocaleTabs, useFocusLocaleWithErrors } from "../i18n/LocaleTabs";
import { Button } from "../ui/Button";
import { Card } from "../ui/layout";
import { NETWORK_ERROR_MESSAGE } from "../ui/useActionSubmit";
import { useConfirm } from "../ui/useConfirm";

export type SiteLink = { label: string; href: string };

/**
 * Common frame of every entity edit form: sticky bar with language tabs and «Сохранить»
 * (also Ctrl/⌘+S), main column + side column, delete with confirmation.
 * Must be rendered inside <EditLocaleProvider>.
 */
export function EntityFormShell({
  onSubmit,
  pending,
  isNew,
  localeGaps,
  localeErrors,
  aside,
  children,
  siteLinks,
  remove,
}: {
  onSubmit: () => void;
  pending: boolean;
  isNew: boolean;
  localeGaps?: Partial<Record<Locale, number>>;
  localeErrors?: Set<Locale>;
  aside?: ReactNode;
  children: ReactNode;
  siteLinks?: SiteLink[];
  /** Delete button (existing rows only). */
  remove?: { entity: PublishableEntity; id: string; noun: string; listHref: string; warning?: string };
}): ReactElement {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [deleting, startDelete] = useTransition();
  const [confirmDialog, confirm] = useConfirm();
  useFocusLocaleWithErrors(localeErrors);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        // Not while a dialog (media library, confirmation) is open on top of the form.
        if (document.querySelector("dialog[open]")) return;
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onDelete = async (): Promise<void> => {
    if (!remove) return;
    const confirmed = await confirm({
      title: `Удалить ${remove.noun}?`,
      description: (
        <>
          Действие нельзя отменить.
          {remove.warning ? <strong className="mt-2 block text-red-fg">{remove.warning}</strong> : null}
          <span className="mt-2 block">Изображения останутся в медиатеке.</span>
        </>
      ),
    });
    if (!confirmed) return;
    startDelete(async () => {
      try {
        const result = await deleteItem(remove.entity, remove.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "Удалено");
        router.push(remove.listHref);
      } catch {
        toast.error(NETWORK_ERROR_MESSAGE);
      }
    });
  };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending) onSubmit();
      }}
      className="flex flex-col gap-6"
    >
      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 lg:top-0 lg:-mx-8 lg:px-8">
        <LocaleTabs gaps={localeGaps} errors={localeErrors} />
        <div className="flex flex-wrap items-center gap-2">
          {siteLinks?.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm text-fg/80 hover:bg-raised-hi hover:text-fg"
            >
              <ExternalLink className="size-4" aria-hidden />
              {link.label}
            </a>
          ))}
          <Button type="submit" variant="primary" pending={pending} icon={<Save className="size-4" aria-hidden />}>
            {isNew ? "Создать" : "Сохранить"}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
        <div className="flex min-w-0 flex-col gap-6">
          {aside}
          {remove ? (
            <Card title="Удаление" bodyClassName="flex flex-col gap-3">
              <p className="text-xs text-muted">Удалить {remove.noun} с сайта и из базы. Это действие нельзя отменить.</p>
              <div>
                <Button
                  variant="danger"
                  size="sm"
                  pending={deleting}
                  icon={<Trash className="size-4" aria-hidden />}
                  onClick={() => void onDelete()}
                >
                  Удалить
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
      {confirmDialog}
    </form>
  );
}
