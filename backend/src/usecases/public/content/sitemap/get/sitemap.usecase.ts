import { Injectable } from '@nestjs/common';

import { SitemapLastModified } from '~core/public-content/sitemap-last-modified';
import { Usecase } from '~usecases/usecase.interfaces';

import { SitemapRepository } from './sitemap.repository';
import { SitemapResponse } from './sitemap.response';

/** lastmod of every public page for sitemap.xml (port of the frontend's getSitemapData). */
@Injectable()
export class SitemapUsecase implements Usecase<void, SitemapResponse> {
  constructor(private readonly repository: SitemapRepository) {}

  async execute(): Promise<SitemapResponse> {
    const [content, collections] = await Promise.all([
      this.repository.findContentLastChanges(),
      this.repository.findCollectionPages(),
    ]);
    const sitemap = SitemapLastModified.of(content, collections);
    return SitemapResponse.of(sitemap.findLanding(), sitemap.collectionPages());
  }
}
