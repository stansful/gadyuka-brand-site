import { describe, expect, it } from "vitest";
import { leadIntentFromSearch } from "@/lib/leads";
import { leadLinkProps, localizeSiteHref, offerCta } from "./lead-links";

describe("leadLinkProps", () => {
  it("targets the in-page form on the landing", () => {
    expect(leadLinkProps({ type: "TAILORING", subject: "" }, "")).toEqual({ href: "#lead-form", "data-lead-type": "TAILORING" });
    expect(leadLinkProps({ type: "CONTACT", subject: "Заказ: Худи" }, "")).toEqual({
      href: "#lead-form",
      "data-lead-type": "CONTACT",
      "data-lead-subject": "Заказ: Худи",
    });
  });

  it("links other pages to the landing with the intent in the query", () => {
    const { href } = leadLinkProps({ type: "CONTACT", subject: "Order: Sign Hoodie" }, "/en");
    expect(href.startsWith("/en?")).toBe(true);
    expect(href.endsWith("#lead-form")).toBe(true);
    expect(leadIntentFromSearch(href.slice(href.indexOf("?"), href.indexOf("#")))).toEqual({
      type: "CONTACT",
      subject: "Order: Sign Hoodie",
    });
  });
});

describe("offerCta", () => {
  it("opens the form for empty links and form-bearing sections", () => {
    expect(offerCta(null)).toEqual({ kind: "form", type: "CONTACT" });
    expect(offerCta("  ")).toEqual({ kind: "form", type: "CONTACT" });
    expect(offerCta("#contacts")).toEqual({ kind: "form", type: "CONTACT" });
    expect(offerCta("#tailoring")).toEqual({ kind: "form", type: "TAILORING" });
    expect(offerCta("/en#partners")).toEqual({ kind: "form", type: "PARTNERSHIP" });
    expect(offerCta("/#lead-form")).toEqual({ kind: "form", type: "CONTACT" });
  });

  it("keeps other links as links", () => {
    expect(offerCta("#gallery")).toEqual({ kind: "link", href: "#gallery", external: false });
    expect(offerCta("/catalog/menya-zapomnyat")).toEqual({ kind: "link", href: "/catalog/menya-zapomnyat", external: false });
    expect(offerCta("https://t.me/gadyuka")).toEqual({ kind: "link", href: "https://t.me/gadyuka", external: true });
  });
});

describe("localizeSiteHref", () => {
  it("puts site-relative CMS links into the page's language", () => {
    expect(localizeSiteHref("/catalog/menya-zapomnyat", "en")).toBe("/en/catalog/menya-zapomnyat");
    expect(localizeSiteHref("/catalog/menya-zapomnyat", "ru")).toBe("/catalog/menya-zapomnyat");
    expect(localizeSiteHref("/en#gallery", "ru")).toBe("/#gallery");
    expect(localizeSiteHref("/en#gallery", "en")).toBe("/en#gallery");
    expect(localizeSiteHref("/#gallery", "en")).toBe("/en#gallery");
    expect(localizeSiteHref("/en/catalog/x?utm=1#product-y", "ru")).toBe("/catalog/x?utm=1#product-y");
    expect(localizeSiteHref("/english-page", "en")).toBe("/en/english-page");
  });

  it("leaves anchors and absolute URLs alone", () => {
    expect(localizeSiteHref("#gallery", "en")).toBe("#gallery");
    expect(localizeSiteHref("https://t.me/gadyuka", "en")).toBe("https://t.me/gadyuka");
    expect(localizeSiteHref("//cdn.example.com/x", "en")).toBe("//cdn.example.com/x");
  });
});

