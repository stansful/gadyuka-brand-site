import { ApiProperty } from '@nestjs/swagger';

import type { PublicMenuItem } from '~shared/contracts/content';

/** Swagger schema of a published menu item (shared/contracts/content.ts). */
export class PublicMenuItemView implements PublicMenuItem {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Localized (ru fallback); items without any label are not listed' })
  label: string;

  @ApiProperty({
    example: '#catalog',
    description: 'As stored: "#anchor", "/catalog/<slug>", "https://…", "mailto:", "tel:"',
  })
  href: string;

  @ApiProperty()
  showInHeader: boolean;

  @ApiProperty()
  showInFooter: boolean;
}
