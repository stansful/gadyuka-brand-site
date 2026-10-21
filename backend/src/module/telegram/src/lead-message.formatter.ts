import { Injectable } from '@nestjs/common';

import { LeadType } from '~core/leads/lead-type';
import { LOCALE_TAGS, DEFAULT_LOCALE } from '~core/locales/locale.enum';

import { HtmlEscaper } from './html-escaper';
import { LeadMessagePresenter } from './lead-message.presenter';
import { OwnerLeadMessagePresenter } from './owner-lead-message.presenter';
import { PreviewLeadMessagePresenter } from './preview-lead-message.presenter';
import { TelegramMessageKey } from './telegram-message-key.enum';
import { TelegramTexts } from './telegram-texts';
import { ADMIN_LEADS_PATH, TELEGRAM_DEFAULTS, TELEGRAM_TIME_ZONE } from './telegram.constants';
import { TelegramLead } from './telegram.interfaces';

interface LeadMessageParts {
  readonly head: string;
  readonly footer: string;
  /** The visitor's message, trimmed (not empty) */
  readonly message: string;
  readonly presenter: LeadMessagePresenter;
}

/**
 * The owner's HTML message about a lead (copy: telegram.* messages). Every message and every
 * visitor-provided value is HTML-escaped; the result never exceeds Telegram's 4096 characters.
 */
@Injectable()
export class LeadMessageFormatter {
  private static readonly EMOJI: Readonly<Record<LeadType, string>> = {
    [LeadType.TAILORING]: '🧵',
    [LeadType.PARTNERSHIP]: '🤝',
    [LeadType.CONTACT]: '💬',
  };
  private static readonly TYPE_TITLES: Readonly<Record<LeadType, TelegramMessageKey>> = {
    [LeadType.TAILORING]: TelegramMessageKey.LEAD_TYPE_TAILORING,
    [LeadType.PARTNERSHIP]: TelegramMessageKey.LEAD_TYPE_PARTNERSHIP,
    [LeadType.CONTACT]: TelegramMessageKey.LEAD_TYPE_CONTACT,
  };

  private readonly escaper = new HtmlEscaper();
  private readonly dateFormat = new Intl.DateTimeFormat(LOCALE_TAGS[DEFAULT_LOCALE], {
    timeZone: TELEGRAM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  constructor(private readonly texts: TelegramTexts) {}

  /** The notification as sent to the owner (with the admin link when `siteUrl` is https). */
  formatForOwner(lead: TelegramLead, siteUrl: string): string {
    return this.format(lead, new OwnerLeadMessagePresenter(siteUrl));
  }

  /** A preview without personal data, for the dry-run log. */
  formatPreview(lead: TelegramLead): string {
    return this.format(lead, new PreviewLeadMessagePresenter());
  }

  private format(lead: TelegramLead, presenter: LeadMessagePresenter): string {
    const head = this.head(lead, presenter);
    const footer = this.footer(lead, presenter.siteUrl);
    const message = lead.message.trim();
    return message === '' ? `${head}\n${footer}` : this.fitMessage({ head, footer, message, presenter });
  }

  private head(lead: TelegramLead, presenter: LeadMessagePresenter): string {
    const title = this.texts.text(TelegramMessageKey.NEW_LEAD, {
      type: this.texts.text(LeadMessageFormatter.TYPE_TITLES[lead.type]),
    });
    const lines = [`${LeadMessageFormatter.EMOJI[lead.type]} <b>${this.escaper.escape(title)}</b>`, ''];
    lines.push(this.line('👤', TelegramMessageKey.NAME, presenter.name(lead.name)));
    lines.push(...this.contactLines(lead, presenter));
    lines.push(this.line('🌐', TelegramMessageKey.LOCALE, lead.locale.toUpperCase()));
    return lines.join('\n');
  }

  private contactLines(lead: TelegramLead, presenter: LeadMessagePresenter): string[] {
    const lines: string[] = [];
    if (lead.phone) {
      lines.push(this.line('📞', TelegramMessageKey.PHONE, presenter.phone(lead.phone)));
    }
    if (lead.email) {
      lines.push(this.line('✉️', TelegramMessageKey.EMAIL, presenter.email(lead.email)));
    }
    return lines;
  }

  private line(icon: string, label: TelegramMessageKey, value: string): string {
    return `${icon} ${this.label(label)} ${this.escaper.escape(value)}`;
  }

  private label(key: TelegramMessageKey): string {
    return `<b>${this.escaper.escape(this.texts.text(key))}</b>`;
  }

  private footer(lead: TelegramLead, siteUrl: string): string {
    const time = this.texts.text(TelegramMessageKey.TIME, { time: this.dateFormat.format(lead.createdAt) });
    const lines = ['', `🕒 ${this.escaper.escape(time)}`, `🆔 <code>${this.escaper.escape(lead.id)}</code>`];
    const origin = siteUrl.replace(/\/+$/, '');
    if (origin.startsWith('https://')) {
      const href = this.escaper.escape(`${origin}${ADMIN_LEADS_PATH}`);
      lines.push(`<a href="${href}">${this.escaper.escape(this.texts.text(TelegramMessageKey.OPEN_ADMIN))}</a>`);
    }
    return lines.join('\n');
  }

  /** Shrinks the visitor's message until the whole text fits into the Telegram limit. */
  private fitMessage(parts: LeadMessageParts): string {
    let limit = parts.presenter.initialMessageLimit;
    let text = this.withMessage(parts, limit);
    while (text.length > TELEGRAM_DEFAULTS.maxMessageLength && limit > TELEGRAM_DEFAULTS.minUserMessageLength) {
      limit = Math.floor(limit * TELEGRAM_DEFAULTS.shrinkFactor);
      text = this.withMessage(parts, limit);
    }
    return text;
  }

  private withMessage(parts: LeadMessageParts, limit: number): string {
    const quoted = this.escaper.escape(parts.presenter.message(parts.message, limit));
    return `${parts.head}\n\n📝 ${this.label(TelegramMessageKey.MESSAGE)}\n<blockquote>${quoted}</blockquote>\n${parts.footer}`;
  }
}
