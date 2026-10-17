import Link from "next/link";
import type { ReactElement } from "react";
import { buttonClasses } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/layout";

export default function AdminNotFound(): ReactElement {
  return (
    <EmptyState
      title="Страница не найдена"
      description="Возможно, запись уже удалили или адрес набран с ошибкой."
      action={
        <Link href="/admin" className={buttonClasses("outline", "sm")}>
          На дашборд
        </Link>
      }
    />
  );
}
