import type { Locale } from '@/i18n/locales';
import { defaultMessage } from '@/i18n/messages';
import type { TextKey } from '@/lib/content/registry';
import type { LeadFormCopy } from '@/lib/lead-form-config';

/**
 * The copy of the contact form («Письмо в редакцию») from the site messages contacts.form.*
 * (LandingContent.texts) — SERVER side (it reads the bundled defaults; the client LeadForm
 * gets the result as a prop).
 *
 * Every visible label of the form has exactly one message. The ones the form cannot do without
 * (field labels, topics, consent, the button, the success notice) are required in the admin;
 * should one still arrive blank (a row emptied in the database by hand), the bundled default of
 * the same key stands in, so a field never loses its label. Placeholders and the subject line
 * may be empty on purpose.
 */

type Texts = Readonly<Record<TextKey, string>>;

function required(texts: Texts, key: TextKey, locale: Locale): string {
  return texts[key].trim() || defaultMessage(key, locale);
}

export function leadFormCopy(texts: Texts, locale: Locale): LeadFormCopy {
  const text = (key: TextKey): string => required(texts, key, locale);
  return {
    topicLabel: text('contacts.form.topicLabel'),
    topics: {
      TAILORING: text('contacts.form.topics.tailoring'),
      PARTNERSHIP: text('contacts.form.topics.partnership'),
      CONTACT: text('contacts.form.topics.contact'),
    },
    subjectLine: texts['contacts.form.subjectLine'],
    labels: {
      email: text('contacts.form.emailLabel'),
      name: text('contacts.form.nameLabel'),
      phone: text('contacts.form.phoneLabel'),
      message: text('contacts.form.commentLabel'),
    },
    placeholders: {
      email: texts['contacts.form.emailPlaceholder'],
      name: texts['contacts.form.namePlaceholder'],
      phone: texts['contacts.form.phonePlaceholder'],
      message: texts['contacts.form.commentPlaceholder'],
    },
    consent: text('contacts.form.consent'),
    submit: text('contacts.form.submit'),
    success: text('contacts.form.success'),
  };
}
