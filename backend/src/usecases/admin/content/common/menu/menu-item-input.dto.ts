import type { LocalizedText } from '~shared/contracts/common';
import type { AdminMenuItemInput } from '~shared/contracts/content-entities';

import { MENU_ITEM_LIMITS } from '~core/content-entities/content-limits.constants';
import { LocalizedTextField } from '~usecases/admin/common/fields/localized-text.field';

import { ContentField } from '../validation/content-field';

/** Body of POST /admin/menu-items and PUT /admin/menu-items/:id (port of the admin's menuItemInputSchema). */
export class MenuItemInputDto implements AdminMenuItemInput {
  @LocalizedTextField.required({ max: MENU_ITEM_LIMITS.LABEL, description: 'Name in the menu (Russian required)' })
  label: LocalizedText;

  @ContentField.menuHref('#section of the landing, /path of the site, https://…, mailto: or tel:')
  href: string;

  @ContentField.flag('Shown in the header menu')
  showInHeader: boolean;

  @ContentField.flag('Shown in the footer links')
  showInFooter: boolean;

  @ContentField.flag('Shown on the site')
  published: boolean;
}
