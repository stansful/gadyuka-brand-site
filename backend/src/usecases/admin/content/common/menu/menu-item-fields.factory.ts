import type { AdminMenuItemInput } from '~shared/contracts/content-entities';

import { LocalizedTextValue } from '~core/locales/localized-text-value';

import { MenuItemFields } from './menu-item.records';

/** A validated menu item form → what is stored (the label normalized; the link is already trimmed). */
export class MenuItemFieldsFactory {
  static fromInput(input: AdminMenuItemInput): MenuItemFields {
    return {
      label: LocalizedTextValue.normalize(input.label),
      href: input.href,
      showInHeader: input.showInHeader,
      showInFooter: input.showInFooter,
      published: input.published,
    };
  }
}
