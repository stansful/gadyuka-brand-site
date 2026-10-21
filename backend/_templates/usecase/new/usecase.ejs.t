---
to: src/usecases/<%= base %>/<%= feature %>/<%= method %>/<%= feature %>.usecase.ts
---
import { Injectable } from '@nestjs/common';

import { Usecase } from '~usecases/usecase.interfaces';

import { <%= h.changeCase.pascal(feature) %>Repository } from './<%= feature %>.repository';
import { <%= h.changeCase.pascal(feature) %>Response } from './<%= feature %>.response';

export interface <%= h.changeCase.pascal(feature) %>Command {
  readonly example: string;
}

@Injectable()
export class <%= h.changeCase.pascal(feature) %>Usecase implements Usecase<<%= h.changeCase.pascal(feature) %>Command, <%= h.changeCase.pascal(feature) %>Response> {
  constructor(private readonly repository: <%= h.changeCase.pascal(feature) %>Repository) {}

  async execute({ example }: <%= h.changeCase.pascal(feature) %>Command): Promise<<%= h.changeCase.pascal(feature) %>Response> {
    const users = await this.repository.countUsers();
    return Object.assign(new <%= h.changeCase.pascal(feature) %>Response(), { example: `${example}: ${users}` });
  }
}
