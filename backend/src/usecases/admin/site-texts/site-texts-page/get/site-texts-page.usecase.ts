import { Injectable } from '@nestjs/common';

import { LocaleMap } from '~core/locales/locale-map';
import { SiteTextCounters } from '~core/site-texts/site-text-counters';
import { SiteTextQuery } from '~core/site-texts/site-text-query';
import { SiteTextRegistry } from '~core/site-texts/site-text-registry';
import { MediaRefRecord } from '~usecases/admin/common/media/media-ref.record';
import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';
import { SiteTextDefinitions } from '~usecases/admin/site-texts/common/site-text-definitions';
import { SiteTextEntryState } from '~usecases/admin/site-texts/common/site-text-entries.builder';
import { SiteTextLabels } from '~usecases/admin/site-texts/common/site-text-labels';
import { SiteTextOverview } from '~usecases/admin/site-texts/common/site-text-overview';
import { Usecase } from '~usecases/usecase.interfaces';

import { SiteImageEntryResponse } from './site-image-entry.response';
import { SiteTextEntryResponse } from './site-text-entry.response';
import { SiteTextGroupResponse } from './site-text-group.response';
import { SiteTextSectionResponse } from './site-text-section.response';
import { SiteTextsPageRepository } from './site-texts-page.repository';
import { SiteTextsPageResponse } from './site-texts-page.response';

export interface SiteTextsPageCommand {
  readonly section: string | undefined;
  readonly query: string | undefined;
}

/**
 * The «Тексты сайта» page: the section tabs with their counters, plus either one section (its texts in
 * shared/messages/ru.json order and its landing images) or — with a non-blank query — the texts of every
 * section that match it (key, admin label, current or default text in any locale).
 * An unknown section falls back to «hero» (or the first section).
 */
@Injectable()
export class SiteTextsPageUsecase implements Usecase<SiteTextsPageCommand, SiteTextsPageResponse> {
  private static readonly FALLBACK_SECTION = 'hero';

  constructor(
    private readonly overview: SiteTextOverview,
    private readonly definitions: SiteTextDefinitions,
    private readonly labels: SiteTextLabels,
    private readonly registry: SiteTextRegistry,
    private readonly repository: SiteTextsPageRepository,
  ) {}

  async execute({ section, query }: SiteTextsPageCommand): Promise<SiteTextsPageResponse> {
    const search = SiteTextQuery.parse(query);
    const entries = await this.overview.findEntries();
    const sections = this.definitions
      .sectionIds()
      .map(id => SiteTextSectionResponse.of(id, this.countersOf(entries, id)));
    if (search.isEmpty()) {
      return SiteTextsPageResponse.ofSection(sections, await this.findSectionGroup(entries, section));
    }
    return SiteTextsPageResponse.ofSearch(sections, search.toString(), this.searchGroups(entries, search));
  }

  private countersOf(entries: readonly SiteTextEntryState[], section: string): SiteTextCounters {
    return SiteTextCounters.of(this.entriesOf(entries, section));
  }

  private async findSectionGroup(
    entries: readonly SiteTextEntryState[],
    requested: string | undefined,
  ): Promise<SiteTextGroupResponse | undefined> {
    const section = this.resolveSection(requested);
    if (section === undefined) {
      return undefined;
    }
    const texts = this.entriesOf(entries, section).map(entry => SiteTextEntryResponse.of(entry));
    return SiteTextGroupResponse.of(section, texts, await this.findImages(section));
  }

  private resolveSection(requested: string | undefined): string | undefined {
    const ids = this.definitions.sectionIds();
    const fallback = ids.includes(SiteTextsPageUsecase.FALLBACK_SECTION)
      ? SiteTextsPageUsecase.FALLBACK_SECTION
      : ids[0];
    return ids.find(id => id === requested) ?? fallback;
  }

  /** The landing images of a section, in registry order (null media: none picked yet). */
  private async findImages(section: string): Promise<SiteImageEntryResponse[]> {
    const keys = this.registry.imageKeysOf(section);
    const rows = keys.length === 0 ? [] : await this.repository.findImages(keys);
    const mediaByKey = new Map(rows.map(row => [row.key, row.media]));
    return keys.map(key => {
      const media = mediaByKey.get(key);
      return SiteImageEntryResponse.of(key, media ? MediaRefResponse.of(MediaRefRecord.toMediaRef(media)) : null);
    });
  }

  private searchGroups(entries: readonly SiteTextEntryState[], search: SiteTextQuery): SiteTextGroupResponse[] {
    const matches = entries.filter(entry => search.matchesAny(this.searchableTextsOf(entry)));
    return this.definitions.sectionIds().flatMap(section => this.searchGroupsOf(section, matches));
  }

  /** The matches of one section as its group (none when the section has no match). */
  private searchGroupsOf(section: string, matches: readonly SiteTextEntryState[]): SiteTextGroupResponse[] {
    const texts = this.entriesOf(matches, section).map(entry => SiteTextEntryResponse.of(entry));
    return texts.length === 0 ? [] : [SiteTextGroupResponse.of(section, texts, [])];
  }

  /** What the search looks in: the key, the admin label, the current and the default text of every locale. */
  private searchableTextsOf(entry: SiteTextEntryState): string[] {
    const { key, defaults } = entry.definition;
    const values = LocaleMap.LOCALES.map(locale => entry.values[locale]);
    return [key, this.labels.labelOf(key), ...values, ...LocaleMap.LOCALES.map(locale => defaults[locale])];
  }

  private entriesOf(entries: readonly SiteTextEntryState[], section: string): SiteTextEntryState[] {
    return entries.filter(entry => entry.definition.section === section);
  }
}
