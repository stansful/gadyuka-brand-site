import { getLocale, getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { toLocale } from "@/i18n/locales";
import { localizedPath } from "@/lib/seo/site-url";
import { ErrorPage } from "@/components/site/ErrorPage";

/** 404 inside a locale — a «dead end» page of the comic (system copy from messages/*.json). */
export default async function NotFound(): Promise<ReactElement> {
  const [t, tCommon, locale] = await Promise.all([getTranslations("notFound"), getTranslations("common"), getLocale()]);
  const home = localizedPath(toLocale(locale), "/");
  return (
    <ErrorPage
      homeHref={home}
      homeLabel={tCommon("homeLink")}
      kicker={t("kicker")}
      title={t("title")}
      caption={t("caption")}
      text={t("text")}
      mark="404"
      action={
        <a className="btn btn--red" href={home}>
          <span className="btn__face">{t("backHome")}</span>
        </a>
      }
    />
  );
}
