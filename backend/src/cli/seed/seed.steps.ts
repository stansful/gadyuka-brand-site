import { Provider, Type } from '@nestjs/common';

import { MessagesDirectory } from '~module/messages';
import { MediaStorageModule } from '~module/storage';

import { AdminUserSeed } from './admin-user.seed';
import { ContentImageSeedRepository } from './content-images/content-image-seed.repository';
import { ContentImageSeeds } from './content-images/content-image-seeds';
import { ContentImagesSeed } from './content-images/content-images.seed';
import { SeedCopy } from './copy/seed-copy';
import { SeedCopyLoader } from './copy/seed-copy.loader';
import { DemoEntityCatalog } from './data/demo-entity.catalog';
import { SeedRowIds } from './data/seed-row-ids';
import { CatalogSeedRepository } from './entities/catalog-seed.repository';
import { CatalogSeeder } from './entities/catalog.seeder';
import { DemoEntitiesRepository } from './entities/demo-entities.repository';
import { DemoEntitiesSeed } from './entities/demo-entities.seed';
import { MediaAltSeedRepository } from './media-alt/media-alt-seed.repository';
import { MediaAltSeed } from './media-alt/media-alt.seed';
import { SeedAssets } from './media/seed-assets';
import { SeedImageEncoder } from './media/seed-image.encoder';
import { SeedMediaFiles } from './media/seed-media.files';
import { SeedMediaIdentity } from './media/seed-media.identity';
import { SeedMediaImporter } from './media/seed-media.importer';
import { SeedMediaRepository } from './media/seed-media.repository';
import { SeedMediaSeed } from './media/seed-media.seed';
import { SeedMediaStore } from './media/seed-media.store';
import { SiteMessageSeedPlanner } from './messages/site-message-seed.planner';
import { SiteMessageSeedRepository } from './messages/site-message-seed.repository';
import { SiteMessagesSeed } from './messages/site-messages.seed';
import { SeedOptions } from './run/seed-options';
import { SeedRun } from './run/seed-run';
import { SeedScopeSeed } from './run/seed-scope.seed';
import { SeedStateRepository } from './run/seed-state.repository';
import { SeedUpdates } from './run/seed-updates';
import { SeedStep } from './seed-step.interface';

/**
 * The steps of `npm run db:seed`, in the order they run (port of the frontend's prisma/seed.ts):
 * 1. AdminUserSeed — the admin account (ADMIN_LOGIN / ADMIN_PASSWORD), the owner of the seed images;
 * 2. SeedScopeSeed — FULL (first run: no site settings row yet, or SEED_OVERWRITE=1) or NEW_IMAGE_KEYS;
 * 3. SiteMessagesSeed — shared/messages/<locale>.json → Message rows (admin edits kept);
 * 4. SeedMediaSeed — backend/assets → WebP → MinIO + Media rows (every image on a FULL run, else only
 *    those of new content image keys); 5. MediaAltSeed — their alt texts (only empty ones);
 * 6. ContentImagesSeed — content_images rows of missing keys;
 * 7. DemoEntitiesSeed — FULL runs only: collection, products, reviews, news, gallery, offers, partners,
 *    menu, social links, then the site settings (the row marks the database as seeded).
 * Every step is idempotent: a second run changes nothing. To add one, write it under src/cli/seed/<area>/
 * (`<area>.seed.ts` implementing SeedStep + its repository), append it below and its providers to
 * SEED_PROVIDERS (a Nest module it needs to SEED_IMPORTS). SeedRunner stops at the first failure.
 */
export const SEED_STEPS: readonly Type<SeedStep>[] = [
  AdminUserSeed,
  SeedScopeSeed,
  SiteMessagesSeed,
  SeedMediaSeed,
  MediaAltSeed,
  ContentImagesSeed,
  DemoEntitiesSeed,
];

/** Providers the steps depend on (besides the steps themselves). */
export const SEED_PROVIDERS: readonly Provider[] = [
  SeedOptions,
  SeedRun,
  SeedUpdates,
  SeedStateRepository,
  SeedRowIds,
  { provide: SeedCopy, useFactory: (): SeedCopy => new SeedCopyLoader(MessagesDirectory.locate()).load() },
  DemoEntityCatalog,
  SiteMessageSeedPlanner,
  SiteMessageSeedRepository,
  SeedAssets,
  SeedMediaIdentity,
  SeedImageEncoder,
  SeedMediaStore,
  SeedMediaFiles,
  SeedMediaRepository,
  SeedMediaImporter,
  MediaAltSeedRepository,
  ContentImageSeedRepository,
  ContentImageSeeds,
  CatalogSeedRepository,
  CatalogSeeder,
  DemoEntitiesRepository,
];

/** Extra Nest modules the steps need (config, database, logger, messages, auth-token, hash are always there). */
export const SEED_IMPORTS: readonly Type<unknown>[] = [MediaStorageModule];
