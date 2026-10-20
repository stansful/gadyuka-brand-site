import type { ReactElement } from 'react';

type RichTextProps = {
  text: string;
  /** data-edit: the message key (omit for entity fields). */
  editKey?: string;
  /** data-field of an entity field (inside a data-entity element). */
  field?: string;
  className?: string;
  /** Fade/rise in on scroll (data-reveal). */
  reveal?: boolean;
};

/**
 * Renders RICHTEXT content: plain text where paragraphs are separated by an empty
 * line and single line breaks are kept. No HTML is ever interpreted.
 */
export function RichText({ text, editKey, field, className, reveal = false }: RichTextProps): ReactElement | null {
  const paragraphs = text
    .split(/\r?\n\s*\r?\n/)
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0);
  if (paragraphs.length === 0) return null;
  return (
    <div className={className} data-edit={editKey} data-field={field} data-reveal={reveal ? '' : undefined}>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>
          {paragraph.split(/\r?\n/).map((line, lineIndex, lines) => (
            <span key={lineIndex}>
              {line}
              {lineIndex < lines.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
