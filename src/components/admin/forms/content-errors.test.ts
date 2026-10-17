import { describe, expect, it } from "vitest";
import { errorLocales, errorsByBlockKey } from "./content-errors";

const keys = ["hero.title", "hero.image"];

describe("errorsByBlockKey", () => {
  it("re-keys server errors from block indexes to block keys (+ locale)", () => {
    expect(
      errorsByBlockKey(
        { "blocks.0.value.en": "Слишком длинно", "blocks.1.mediaId": "Выберите изображение", section: "?" },
        keys,
      ),
    ).toEqual({ "hero.title.en": "Слишком длинно", "hero.image": "Выберите изображение", section: "?" });
  });

  it("never loses an error with an unknown or region-tagged suffix (falls back to the block)", () => {
    expect(errorsByBlockKey({ "blocks.0.value.pt-br": "Ошибка" }, keys)).toEqual({ "hero.title": "Ошибка" });
    expect(errorLocales({ "hero.title": "Ошибка" }, keys)).toEqual(new Set(["ru"]));
  });

  it("marks the language tab of each error", () => {
    expect(errorLocales({ "hero.title.en": "x", "hero.image": "y" }, keys)).toEqual(new Set(["en", "ru"]));
  });
});
