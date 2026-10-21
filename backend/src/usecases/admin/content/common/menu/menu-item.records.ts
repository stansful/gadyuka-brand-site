import type { LocalizedText } from '~shared/contracts/common';

/** What a menu item stores (create / update; the order is set on create only). */
export interface MenuItemFields {
  readonly label: LocalizedText;
  readonly href: string;
  readonly showInHeader: boolean;
  readonly showInFooter: boolean;
  readonly published: boolean;
}

/** A menu item (list rows and the edit form). */
export interface MenuItemRecord extends MenuItemFields {
  readonly id: string;
}
