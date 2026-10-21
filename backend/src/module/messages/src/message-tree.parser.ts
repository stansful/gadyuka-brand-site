import { MessageTree } from './message-tree';

/** Checks that parsed JSON is a message tree (objects of strings, nested), without trusting its type. */
export class MessageTreeParser {
  parse(value: unknown, source: string): MessageTree {
    if (!this.isTree(value)) {
      throw new Error(`${source} is not a message tree (objects whose leaves are strings)`);
    }
    return value;
  }

  private isTree(value: unknown): value is MessageTree {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    return Object.values(value).every(child => typeof child === 'string' || this.isTree(child));
  }
}
