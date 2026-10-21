import { Injectable, StreamableFile } from '@nestjs/common';
import { InjectDisk, StorageDisk, serveFile } from '@nestjs/storage';

import { FastifyReply, FastifyRequest } from 'fastify';

import { MEDIA_CACHE_CONTROL, MEDIA_CONTENT_SECURITY_POLICY } from '~core/media/media.constants';

import { MEDIA_DISK } from './storage.constants';

/** The HTTP exchange a file is served into (passed through from the controller untouched). */
export interface MediaHttpExchange {
  readonly request: FastifyRequest;
  readonly reply: FastifyReply;
}

/**
 * Streams a media object as the response (@nestjs/storage serveFile): Content-Type / -Length,
 * ETag + If-None-Match → 304, Range → 206, nosniff, inline only for raster images; plus an
 * immutable Cache-Control (keys are never reused) and a sandbox CSP. A missing object → 404.
 */
@Injectable()
export class MediaFileServer {
  constructor(@InjectDisk(MEDIA_DISK) private readonly disk: StorageDisk) {}

  async serve(key: string, { request, reply }: MediaHttpExchange): Promise<StreamableFile | undefined> {
    reply.header('Content-Security-Policy', MEDIA_CONTENT_SECURITY_POLICY);
    return serveFile(this.disk, key, {
      req: request,
      res: reply,
      disposition: 'inline',
      cacheControl: MEDIA_CACHE_CONTROL,
    });
  }
}
