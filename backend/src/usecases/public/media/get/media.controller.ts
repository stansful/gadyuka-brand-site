import { Controller, Get, Param, Req, Res, StreamableFile } from '@nestjs/common';
import { NodeRequest, NodeResponse } from '@nestjs/platform-node';
import { ApiExcludeController } from '@nestjs/swagger';

import { NoInternalKey, Public } from '~decorator';

import { MEDIA_KEY_PARAM, MEDIA_ROUTE } from './media.route';
import { MediaUsecase } from './media.usecase';

/** GET|HEAD /media/<key> (HEAD uses the GET route, without the body). */
@ApiExcludeController()
@Controller()
export class MediaController {
  constructor(private readonly usecase: MediaUsecase) {}

  @NoInternalKey()
  @Public()
  @Get(MEDIA_ROUTE)
  async execute(
    @Param(MEDIA_KEY_PARAM) segments: string[] | undefined,
    @Req() request: NodeRequest,
    @Res({ passthrough: true }) reply: NodeResponse,
  ): Promise<StreamableFile | undefined> {
    return this.usecase.execute({ path: (segments ?? []).join('/'), http: { request, reply } });
  }
}
