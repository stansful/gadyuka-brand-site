import type { Metadata } from "next";
import type { ReactElement } from "react";
import { SettingsForm } from "@/components/admin/forms/SettingsForm";
import { PageHeader } from "@/components/admin/ui/layout";
import { getSettingsForm } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Настройки" };

export default async function SettingsPage(): Promise<ReactElement> {
  const settings = await getSettingsForm();
  return (
    <>
      <PageHeader title="Настройки" description="Контакты, соцсети и SEO сайта на каждом языке." />
      <SettingsForm initial={settings} />
    </>
  );
}
