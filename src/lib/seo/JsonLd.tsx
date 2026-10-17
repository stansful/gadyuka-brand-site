import type { ReactElement } from "react";
import { type JsonLdObject, serializeJsonLd } from "./json-ld";

/** Renders schema.org structured data as <script type="application/ld+json"> (XSS-safe). */
export function JsonLd({ data }: { data: JsonLdObject }): ReactElement {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
