import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ru from "../../../messages/ru.json";
import { ERROR_COPY } from "./error-copy";

describe("ERROR_COPY", () => {
  it("mirrors messages/*.json", () => {
    for (const [locale, messages] of [
      ["ru", ru],
      ["en", en],
    ] as const) {
      expect(ERROR_COPY[locale]).toEqual({
        kicker: messages.error.kicker,
        title: messages.error.title,
        caption: messages.error.caption,
        text: messages.error.text,
        retry: messages.error.retry,
        backHome: messages.notFound.backHome,
        homeLink: messages.common.homeLink,
      });
    }
  });
});
