"use client";

import { Wand } from "lucide-react";
import type { ReactElement } from "react";
import { slugify } from "@/lib/admin/slug";
import { describedBy, Field } from "../ui/Field";
import { TextInput } from "../ui/inputs";

/** URL slug input with «из названия» (transliterates the Russian title). */
export function SlugField({
  id,
  value,
  onChange,
  source,
  error,
  prefix,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  /** Russian title to generate from. */
  source: string;
  error?: string;
  /** Shown before the input, e.g. "/catalog/". */
  prefix?: string;
}): ReactElement {
  const hint = "Латиница, цифры и дефисы. Используется в адресе страницы и не должен повторяться.";
  return (
    <Field htmlFor={id} label="Адрес (slug)" required hint={hint} error={error}>
      <div className="flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-md">
          {prefix ? <span className="mr-2 shrink-0 font-mono text-xs text-muted">{prefix}</span> : null}
          <TextInput
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value.toLowerCase())}
            invalid={Boolean(error)}
            aria-describedby={describedBy(id, hint, error)}
            aria-required
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            maxLength={120}
          />
        </div>
        <button
          type="button"
          onClick={() => onChange(slugify(source))}
          disabled={!source.trim()}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-line-strong px-3 text-xs text-fg/80 hover:bg-raised disabled:opacity-40"
          title="Сгенерировать из русского названия"
        >
          <Wand className="size-4" aria-hidden />
          Из названия
        </button>
      </div>
    </Field>
  );
}
