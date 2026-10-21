import { Controller, Get, Param, Req, Res, StreamableFile } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { FastifyReply, FastifyRequest } from 'fastify';

import { NoInternalKey, Public } from '~decorator';

import { MEDIA_KEY_PARAM, MEDIA_ROUTE } from './media.route';
import { MediaUsecase } from './media.usecase';

/** GET|HEAD /media/<key> (Fastify answers HEAD with the GET route, without the body). */
@ApiExcludeController()
@Controller()
export class MediaController {
  constructor(private readonly usecase: MediaUsecase) {}

  @NoInternalKey()
  @Public()
  @Get(MEDIA_ROUTE)
  async execute(
    @Param(MEDIA_KEY_PARAM) path: string,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<StreamableFile | undefined> {
    return this.usecase.execute({ path, http: { request, reply } });
  }
}
