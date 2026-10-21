/** A nested message tree as in shared/messages/*.json: branches are objects, leaves are strings. */
export interface MessageTree {
  readonly [key: string]: string | MessageTree;
}

/** { "hero.title": "ГАДЮКА", … } — every leaf by its dotted path. */
export type FlatMessages = Readonly<Record<string, string>>;
