import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { IpNetwork } from './ip-network';
import { LeadFormRules } from './lead-form.rules';
import { LeadListPage } from './lead-list-page';
import { LeadMeta } from './lead-meta';
import { LeadMetaEntries } from './lead-meta-entries';
import { LeadPhoneNumber } from './lead-phone-number';
import { LeadPreview } from './lead-preview';
import { LeadRateWindow } from './lead-rate-window';
import { LeadSubmission } from './lead-submission';
import { LeadType } from './lead-type';
import { LEAD_RATE_LIMIT, LEADS_PAGE_SIZE } from './lead.constants';

describe('LeadPhoneNumber', () => {
  it('normalizes to "+<digits>", with the Russian conveniences', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['+7 (900) 123-45-67', '+79001234567'],
      ['8 900 123 45 67', '+79001234567'],
      ['89001234567', '+79001234567'],
      ['9001234567', '+79001234567'],
      ['+44 20 7946 0958', '+442079460958'],
      ['+375 (29) 123-45-67', '+375291234567'],
    ];
    for (const [input, expected] of cases) {
      strictEqual(LeadPhoneNumber.findNormalized(input), expected, input);
    }
  });

  it('rejects what cannot be a phone number', () => {
    for (const input of ['', '12345', '+7 900 abc 45 67', 'phone', '+1234567890123456', '0000000000', '1'.repeat(33)]) {
      strictEqual(LeadPhoneNumber.findNormalized(input), undefined, input);
    }
  });
});

describe('IpNetwork', () => {
  it('keeps IPv4, maps IPv4-mapped IPv6 back to IPv4', () => {
    strictEqual(IpNetwork.of('203.0.113.7'), '203.0.113.7');
    strictEqual(IpNetwork.of('::ffff:203.0.113.7'), '203.0.113.7');
    strictEqual(IpNetwork.of('::FFFF:cb00:7107'), '203.0.113.7');
  });

  it('reduces IPv6 to the /64 prefix, whatever the notation', () => {
    strictEqual(IpNetwork.of('2001:db8::1'), '2001:db8:0:0::/64');
    strictEqual(IpNetwork.of('2001:0DB8:0000:0000:0000:0000:0000:0001'), '2001:db8:0:0::/64');
    strictEqual(IpNetwork.of('2001:db8:1:2:3:4:5:6'), '2001:db8:1:2::/64');
    strictEqual(IpNetwork.of('2001:db8:1:2::'), '2001:db8:1:2::/64');
    strictEqual(IpNetwork.of('::1'), '0:0:0:0::/64');
    strictEqual(IpNetwork.of('64:ff9b::198.51.100.4'), '64:ff9b:0:0::/64');
  });

  it('keeps anything else as is (the shared bucket of unknown visitors)', () => {
    strictEqual(IpNetwork.of(' unknown '), 'unknown');
  });
});

describe('LeadRateWindow', () => {
  const now = new Date('2026-10-16T12:00:00.000Z');
  const window = LeadRateWindow.PER_NETWORK;

  it('allows up to 5 leads per network in 10 minutes', () => {
    deepStrictEqual(window.startOf(now), new Date(now.getTime() - LEAD_RATE_LIMIT.windowMs));
    strictEqual(window.isFullWith(LEAD_RATE_LIMIT.max - 1), false);
    strictEqual(window.isFullWith(LEAD_RATE_LIMIT.max), true);
  });

  it('computes Retry-After from the oldest lead in the window, else the whole window', () => {
    const oldest = new Date(now.getTime() - 4 * 60 * 1000);
    strictEqual(window.retryAfterSeconds(oldest, now), 6 * 60);
    strictEqual(window.retryAfterSeconds(undefined, now), LEAD_RATE_LIMIT.windowMs / 1000);
    strictEqual(window.retryAfterSeconds(new Date(now.getTime() - LEAD_RATE_LIMIT.windowMs), now), 1);
  });

  it('describes the site-wide ceiling: 60 leads in 10 minutes', () => {
    strictEqual(LeadRateWindow.SITE_WIDE.max, 60);
    strictEqual(LeadRateWindow.SITE_WIDE.minutes, 10);
  });
});

describe('LeadFormRules', () => {
  it('treats empty, whitespace, null and undefined as not provided', () => {
    for (const value of ['', '   ', null, undefined]) {
      strictEqual(LeadFormRules.isBlank(value), true, String(value));
    }
    strictEqual(LeadFormRules.isBlank(0), false);
  });

  it('sees a bot in any honeypot value but absent / null / ""', () => {
    for (const hp of ['http://spam.example', 'x', ' ', 1, false, {}]) {
      strictEqual(LeadFormRules.isHoneypotFilled({ hp }), true, JSON.stringify(hp));
    }
    for (const hp of ['', null, undefined]) {
      strictEqual(LeadFormRules.isHoneypotFilled({ hp }), false, String(hp));
    }
    strictEqual(LeadFormRules.isHoneypotWellFormed({ hp: null }), false);
  });

  it('checks the fields only for a known type and an empty honeypot', () => {
    strictEqual(LeadFormRules.isFormChecked({ type: 'CONTACT', hp: '' }), true);
    strictEqual(LeadFormRules.isFormChecked({ type: 'SPAM' }), false);
    strictEqual(LeadFormRules.isFormChecked({ type: 'CONTACT', hp: 'x' }), false);
    strictEqual(LeadFormRules.isTypeChecked({ type: 'NOPE', hp: 'x' }), false);
  });
});

describe('LeadSubmission', () => {
  it('trims, normalizes the phone and makes missing values explicit', () => {
    const lead = LeadSubmission.fromCheckedForm({
      type: LeadType.TAILORING,
      name: ' Иван Петров ',
      email: '   ',
      phone: '8 (900) 123-45-67',
      message: '  Хочу худи  ',
      locale: 'ru',
    });
    deepStrictEqual(
      { ...lead },
      {
        type: 'TAILORING',
        name: 'Иван Петров',
        email: null,
        phone: '+79001234567',
        message: 'Хочу худи',
        locale: 'ru',
      },
    );
  });

  it('keeps a given e-mail, an absent message as "" and falls back to ru for unknown locales', () => {
    const lead = LeadSubmission.fromCheckedForm({
      type: LeadType.CONTACT,
      name: 'Иван',
      email: ' a@b.co ',
      locale: 'de',
    });
    deepStrictEqual([lead.email, lead.phone, lead.message, lead.locale], ['a@b.co', null, '', 'ru']);
    strictEqual(LeadSubmission.fromCheckedForm({ type: LeadType.CONTACT, name: 'Ivan', locale: 'en' }).locale, 'en');
  });
});

describe('LeadMeta', () => {
  it('records the consent time, clips the user agent / referer and marks the source', () => {
    const receivedAt = new Date('2026-10-16T12:00:00.000Z');
    deepStrictEqual(LeadMeta.of({ receivedAt, userAgent: 'u'.repeat(1000), referer: undefined }), {
      consentAt: '2026-10-16T12:00:00.000Z',
      userAgent: 'u'.repeat(300),
      referer: null,
      source: 'site',
    });
    strictEqual(LeadMeta.of({ receivedAt, userAgent: undefined, referer: 'r'.repeat(600) }).referer, 'r'.repeat(500));
  });
});

describe('LeadPreview', () => {
  it('puts the message on one line and cuts it to 140 characters', () => {
    strictEqual(LeadPreview.of('  Хочу\n\n худи  '), 'Хочу худи');
    strictEqual(LeadPreview.of('я'.repeat(141)), `${'я'.repeat(140)}…`);
    strictEqual(LeadPreview.of('я'.repeat(140)), 'я'.repeat(140));
  });
});

describe('LeadMetaEntries', () => {
  it('lists an object (strings as is, the rest as JSON), at most 50 entries', () => {
    deepStrictEqual(LeadMetaEntries.of({ consentAt: '2026', referer: null, flags: [1] }), [
      { key: 'consentAt', value: '2026' },
      { key: 'referer', value: 'null' },
      { key: 'flags', value: '[1]' },
    ]);
    const many = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`k${index}`, index]));
    strictEqual(LeadMetaEntries.of(many).length, 50);
  });

  it('shows another value as one "meta" entry, and nothing for null', () => {
    deepStrictEqual(LeadMetaEntries.of(['a']), [{ key: 'meta', value: '["a"]' }]);
    deepStrictEqual(LeadMetaEntries.of('text'), [{ key: 'meta', value: '"text"' }]);
    deepStrictEqual(LeadMetaEntries.of(null), []);
  });
});

describe('LeadListPage', () => {
  it('clamps the requested page to 1…pageCount (an empty list has one page)', () => {
    const empty = LeadListPage.of(3, 0);
    deepStrictEqual([empty.number, empty.count, empty.offset], [1, 1, 0]);
    const last = LeadListPage.of(99, LEADS_PAGE_SIZE * 2 + 1);
    deepStrictEqual([last.number, last.count, last.offset, last.size], [3, 3, LEADS_PAGE_SIZE * 2, LEADS_PAGE_SIZE]);
    strictEqual(LeadListPage.of(-5, 10).number, 1);
    ok(LeadListPage.of(Number.MAX_SAFE_INTEGER, 30).number === 2);
  });
});
