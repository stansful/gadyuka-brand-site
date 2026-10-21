import { FlatMessages, MessageTree } from './message-tree';

interface MutableMessageTree {
  [key: string]: string | MutableMessageTree;
}

/** Nested tree ⇄ flat map of dotted keys ("about.advantages.0.title"), in document order. */
export class MessageTreeFlattener {
  flatten(tree: MessageTree): FlatMessages {
    const flat: Record<string, string> = {};
    this.collectLeaves(tree, '', flat);
    return flat;
  }

  /** Throws on a key that is both a leaf and a branch ({ a: "x", "a.b": "y" }) or has an empty segment. */
  unflatten(flat: FlatMessages): MessageTree {
    const tree: MutableMessageTree = {};
    for (const [key, value] of Object.entries(flat)) {
      this.setLeaf(tree, key, value);
    }
    return tree;
  }

  private collectLeaves(tree: MessageTree, prefix: string, flat: Record<string, string>): void {
    for (const [key, value] of Object.entries(tree)) {
      const path = prefix === '' ? key : `${prefix}.${key}`;
      if (typeof value === 'string') {
        flat[path] = value;
        continue;
      }
      this.collectLeaves(value, path, flat);
    }
  }

  private setLeaf(tree: MutableMessageTree, key: string, value: string): void {
    const parts = key.split('.');
    if (parts.some(part => part === '')) {
      throw new Error(`Invalid message key "${key}"`);
    }
    const leaf = parts.pop() ?? '';
    const branch = parts.reduce((node, part) => this.childBranch(node, part, key), tree);
    if (typeof branch[leaf] === 'object') {
      throw new Error(`Message key "${key}" is a branch, not a leaf`);
    }
    branch[leaf] = value;
  }

  private childBranch(node: MutableMessageTree, part: string, key: string): MutableMessageTree {
    const child = node[part];
    if (typeof child === 'string') {
      throw new Error(`Message key "${key}" conflicts with the leaf at "${part}"`);
    }
    return child ?? (node[part] = {});
  }
}
