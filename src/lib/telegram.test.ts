import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TelegramLead } from "./telegram";

const leadUpdate = vi.fn();
const leadFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { lead: { update: leadUpdate, findUnique: leadFindUnique } },
}));

const {
  DRY_RUN_ERROR,
  escapeHtml,
  formatLeadMessage,
  maskEmail,
  maskPhone,
  resendLeadToTelegram,
  sendLeadToTelegram,
  sendTelegramMessage,
  TELEGRAM_DEFAULTS,
} = await import("./telegram");

const TOKEN = "123456789:AAFakeTokenForTests_abcdefghijklmnop";
const LIVE = { config: { dryRun: false, token: TOKEN, chatId: "424242", siteUrl: "" } } as const;

const lead: TelegramLead = {
  id: "clead123",
  type: "TAILORING",
  name: "Иван <b>Петров</b>",
  email: "ivan@mail.ru",
  phone: "+79001234567",
  message: "Хочу худи & штаны <script>alert(1)</script>",
  locale: "ru",
  createdAt: new Date("2026-10-16T09:30:00.000Z"),
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const noSleep = vi.fn(async (_ms: number) => {});

beforeEach(() => {
  leadUpdate.mockReset().mockResolvedValue({});
  leadFindUnique.mockReset();
  noSleep.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("escapeHtml", () => {
  it("escapes the characters Telegram HTML cares about", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;");
  });

  it("does not double-escape when applied once to raw input", () => {
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });
});

describe("formatLeadMessage", () => {
  it("builds a readable Russian message with the type emoji and escaped user input", () => {
    const text = formatLeadMessage(lead);
    expect(text).toContain("🧵 <b>Новая заявка: Индивидуальный пошив</b>");
    expect(text).toContain("👤 <b>Имя:</b> Иван &lt;b&gt;Петров&lt;/b&gt;");
    expect(text).toContain("📞 <b>Телефон:</b> +79001234567");
    expect(text).toContain("✉️ <b>E-mail:</b> ivan@mail.ru");
    expect(text).toContain("<blockquote>Хочу худи &amp; штаны &lt;script&gt;alert(1)&lt;/script&gt;</blockquote>");
    expect(text).toContain("🕒 16.10.2026, 12:30 (МСК)");
    expect(text).toContain("🆔 <code>clead123</code>");
    expect(text).not.toContain("<script>");
    expect(text).not.toContain("<b>Петров</b>");
  });

  it("uses a different emoji per type and omits empty fields", () => {
    const partnership = formatLeadMessage({ ...lead, type: "PARTNERSHIP", phone: null, message: "" });
    expect(partnership.startsWith("🤝 <b>Новая заявка: Сотрудничество</b>")).toBe(true);
    expect(partnership).not.toContain("Телефон");
    expect(partnership).not.toContain("Сообщение");
    expect(formatLeadMessage({ ...lead, type: "CONTACT" }).startsWith("💬")).toBe(true);
  });

  it("adds the admin link only for https sites", () => {
    expect(formatLeadMessage(lead, { siteUrl: "https://gadyuka.ru/" })).toContain(
      '<a href="https://gadyuka.ru/admin/leads">Открыть заявки в админке</a>',
    );
    expect(formatLeadMessage(lead, { siteUrl: "http://localhost:3000" })).not.toContain("<a href");
  });

  it("stays within the 4096-character Telegram limit", () => {
    const text = formatLeadMessage({ ...lead, message: "<&>".repeat(2000) });
    expect(text.length).toBeLessThanOrEqual(TELEGRAM_DEFAULTS.maxMessageLength);
    expect(text).toContain("…</blockquote>");
  });

  it("redacts contacts and shortens the message for logs", () => {
    const text = formatLeadMessage({ ...lead, message: "x".repeat(500) }, { redact: true });
    expect(text).toContain("+7******4567");
    expect(text).toContain("i***@mail.ru");
    expect(text).not.toContain("+79001234567");
    expect(text).not.toContain("x".repeat(250));
  });
});

describe("masking", () => {
  it("masks phones and emails", () => {
    expect(maskPhone("+79001234567")).toBe("+7******4567");
    expect(maskEmail("ivan@mail.ru")).toBe("i***@mail.ru");
    expect(maskEmail("broken")).toBe("***");
  });
});

describe("sendTelegramMessage", () => {
  it("dry run: no network, ok", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const result = await sendTelegramMessage("hi", {
      fetch: fetchMock,
      config: { dryRun: true, token: TOKEN, chatId: "1" },
    });
    expect(result).toEqual({ ok: true, dryRun: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never touches the network under Vitest without an injected fetch", async () => {
    const globalFetch = vi.spyOn(globalThis, "fetch");
    const result = await sendTelegramMessage("hi", { config: { dryRun: false, token: TOKEN, chatId: "1" } });
    expect(result.dryRun).toBe(true);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it("posts sendMessage with parse_mode HTML", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true, result: {} }));
    const result = await sendTelegramMessage("<b>hi</b>", { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(JSON.parse(String(init?.body))).toEqual({
      chat_id: "424242",
      text: "<b>hi</b>",
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  });

  it("retries 5xx / network errors twice with backoff, then succeeds", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse({ ok: false, error_code: 502, description: "Bad Gateway" }, 502))
      .mockResolvedValueOnce(jsonResponse({ ok: true, result: {} }));
    const result = await sendTelegramMessage("hi", { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(noSleep.mock.calls.map(([ms]) => ms)).toEqual([...TELEGRAM_DEFAULTS.backoffMs]);
  });

  it("gives up after 1 + 2 attempts and returns the last error", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ ok: false, description: "Internal" }, 500));
    const result = await sendTelegramMessage("hi", { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ ok: false, error: "Telegram API 500: Internal" });
  });

  it("does not retry client errors (e.g. chat not found)", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({ ok: false, error_code: 400, description: "Bad Request: chat not found" }, 400),
    );
    const result = await sendTelegramMessage("hi", { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, error: "Telegram API 400: Bad Request: chat not found" });
  });

  it("honours retry_after on 429", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ok: false, error_code: 429, parameters: { retry_after: 3 } }, 429))
      .mockResolvedValueOnce(jsonResponse({ ok: true, result: {} }));
    const result = await sendTelegramMessage("hi", { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(result.ok).toBe(true);
    expect(noSleep).toHaveBeenCalledWith(3000);
  });

  it("never leaks the bot token in errors", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new Error(`connect failed for https://api.telegram.org/bot${TOKEN}/sendMessage`);
    });
    const result = await sendTelegramMessage("hi", { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain(TOKEN);
    expect(result.error).toContain("***");
  });

  it("reports a missing configuration without calling the API", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const result = await sendTelegramMessage("hi", {
      fetch: fetchMock,
      config: { dryRun: false, token: "", chatId: "" },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/TELEGRAM_BOT_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sendLeadToTelegram", () => {
  it("dry run (TELEGRAM_DRY_RUN=1): logs a redacted preview, records it as NOT delivered, no network", async () => {
    expect(process.env.TELEGRAM_DRY_RUN).toBe("1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi.fn<typeof fetch>();
    const result = await sendLeadToTelegram(lead, { fetch: fetchMock });
    expect(result).toEqual({ ok: true, dryRun: true });
    expect(fetchMock).not.toHaveBeenCalled();
    const logged = info.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(logged).toContain("DRY RUN");
    expect(logged).toContain("+7******4567");
    expect(logged).not.toContain("+79001234567");
    expect(logged).not.toContain("ivan@mail.ru");
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: "clead123" },
      data: { telegramSent: false, telegramError: DRY_RUN_ERROR },
    });
  });

  it("records a real delivery as sent", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true, result: {} }));
    const result = await sendLeadToTelegram(lead, { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(result).toEqual({ ok: true });
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: "clead123" },
      data: { telegramSent: true, telegramError: null },
    });
  });

  it("keeps the lead and records the error when Telegram fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({ ok: false, description: "Forbidden: bot was blocked by the user" }, 403),
    );
    const result = await sendLeadToTelegram(lead, { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(result).toEqual({ ok: false, error: "Telegram API 403: Forbidden: bot was blocked by the user" });
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: "clead123" },
      data: { telegramSent: false, telegramError: "Telegram API 403: Forbidden: bot was blocked by the user" },
    });
  });

  it("never throws, even if recording the result fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    leadUpdate.mockRejectedValueOnce(new Error("db down"));
    await expect(sendLeadToTelegram(lead)).resolves.toEqual({ ok: true, dryRun: true });
  });
});

describe("resendLeadToTelegram", () => {
  it("returns a Russian error for an unknown lead", async () => {
    leadFindUnique.mockResolvedValueOnce(null);
    await expect(resendLeadToTelegram("missing")).resolves.toEqual({ ok: false, error: "Заявка не найдена" });
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("validates the id", async () => {
    await expect(resendLeadToTelegram("")).resolves.toEqual({ ok: false, error: "Некорректный идентификатор заявки" });
    expect(leadFindUnique).not.toHaveBeenCalled();
  });

  it("loads the lead and reports a dry run as «not sent» (never as delivered)", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    leadFindUnique.mockResolvedValueOnce(lead);
    await expect(resendLeadToTelegram("clead123")).resolves.toEqual({ ok: false, error: DRY_RUN_ERROR });
    expect(leadFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "clead123" } }));
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: "clead123" },
      data: { telegramSent: false, telegramError: DRY_RUN_ERROR },
    });
  });
});
