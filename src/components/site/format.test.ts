import { describe, expect, it } from "vitest";
import { formatMonthYear, formatShortDate, pad2, socialLabel } from "./format";

describe("socialLabel", () => {
  it("uses the brand name for known networks", () => {
    expect(socialLabel({ type: "telegram", url: "https://t.me/gadyuka" })).toBe("Telegram");
    expect(socialLabel({ type: "vk", url: "https://vk.com/gadyuka" })).toBe("VK");
  });

  it("labels «other» (and unknown legacy types) with the link's host, never the raw type", () => {
    expect(socialLabel({ type: "other", url: "https://www.behance.net/gadyuka" })).toBe("behance.net");
    expect(socialLabel({ type: "myspace", url: "https://myspace.com/x" })).toBe("myspace.com");
  });
});

describe("dates and numbers", () => {
  it("prints the newspaper dateline and the masthead month", () => {
    expect(formatShortDate("2026-10-01T09:00:00.000Z", "ru")).toBe("01.10.2026");
    expect(formatMonthYear("2026-10-10T09:00:00.000Z", "ru")).toBe("Октябрь 2026");
    expect(formatMonthYear("2026-10-10T09:00:00.000Z", "en")).toBe("October 2026");
  });

  it("pads chapter numbers", () => {
    expect(pad2(2)).toBe("02");
    expect(pad2(12)).toBe("12");
  });
});
