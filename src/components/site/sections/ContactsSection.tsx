import { getMessages } from "next-intl/server";
import type { ReactElement } from "react";
import type { LandingContent } from "@/lib/content";
import { LEAD_FORM_ANCHOR, SECTION_ANCHORS, chapterNumber } from "@/lib/content";
import { leadFormCopyFromTexts } from "@/lib/leads";
import { socialLabel } from "../format";
import { LeadForm } from "../LeadForm";
import { RichText } from "../RichText";
import { ChapterScene } from "../scenes/ChapterScene";
import { ChapterHeader, Folio } from "./parts";

/** Глава 09 · Контакты: contacts from «Настройки» and the site's lead form — «Письмо в редакцию». */
export async function ContactsSection({ content }: { content: LandingContent }): Promise<ReactElement> {
  const { texts, settings, locale } = content;
  const { forms } = await getMessages();
  const phoneHref = settings.phone.replace(/[^\d+]/g, "");
  return (
    <ChapterScene id={SECTION_ANCHORS.contacts} className="page" labelledBy="contacts-title" folio={chapterNumber("contacts")}>
      <div className="wrap">
        <ChapterHeader chapter="contacts" texts={texts} titleKey="contacts.title" narrationKey="contacts.narration" headingId="contacts-title" />

        <div className="grid grid--contacts">
          <div className="panel panel--ink c-info dots" data-wipe="left">
            <RichText text={texts["contacts.text"]} editKey="contacts.text" className="lead" />
            <dl className="cdl" data-entity="SiteSettings" data-entity-id="1">
              {settings.phone ? (
                <div>
                  <dt data-edit="contacts.phoneLabel">{texts["contacts.phoneLabel"]}</dt>
                  <dd>
                    <a href={`tel:${phoneHref}`} data-field="phone">
                      {settings.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {settings.email ? (
                <div>
                  <dt data-edit="contacts.emailLabel">{texts["contacts.emailLabel"]}</dt>
                  <dd>
                    <a href={`mailto:${settings.email}`} data-field="email">
                      {settings.email}
                    </a>
                  </dd>
                </div>
              ) : null}
              {settings.address ? (
                <div>
                  <dt data-edit="contacts.addressLabel">{texts["contacts.addressLabel"]}</dt>
                  <dd data-field="address">{settings.address}</dd>
                </div>
              ) : null}
              {settings.socials.length > 0 ? (
                <div>
                  <dt data-edit="contacts.socialsLabel">{texts["contacts.socialsLabel"]}</dt>
                  <dd className="cdl__soc">
                    {settings.socials.map((social, index) => (
                      <a key={`${social.type}-${index}`} href={social.url} target="_blank" rel="noopener noreferrer" data-field="socials">
                        {socialLabel(social)}
                      </a>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="panel panel--paper letter" id={LEAD_FORM_ANCHOR} data-wipe="right">
            <p className="letter__to" data-edit="contacts.form.to">
              {texts["contacts.form.to"]}
            </p>
            <h3 className="letter__title" data-edit="contacts.form.title">
              {texts["contacts.form.title"]}
            </h3>
            <LeadForm locale={locale} copy={leadFormCopyFromTexts(texts)} labels={forms} />
          </div>
        </div>
      </div>
      <Folio chapter="contacts" />
    </ChapterScene>
  );
}
