import { HttpAdapterHost } from '@nestjs/core';

import type { AddressInfo } from 'node:net';

import { ConfigService } from '~config';
import { RequestHeader } from '~core/constants/request-header.enum';
import { ApiResponse } from '~test/e2e/api-client';
import { TestApp } from '~test/e2e/test-app';

/** A request body sent as is, with its own content type (multipart forms, malformed bodies). */
export interface RawBody {
  readonly body: FormData | string;
  /** Set for string bodies; FormData brings its own (with the boundary) */
  readonly contentType?: string;
}

/** POSTs multipart (or any raw) bodies to the test app, as the Next.js server streams uploads. */
export class MultipartClient {
  private constructor(
    private readonly baseUrl: string,
    private readonly internalKey: string,
  ) {}

  static of(app: TestApp): MultipartClient {
    const address = app.get(HttpAdapterHost).httpAdapter.getHttpServer().address() as AddressInfo;
    return new MultipartClient(
      `http://127.0.0.1:${address.port}`,
      app.get(ConfigService).getSafety('INTERNAL_API_KEY'),
    );
  }

  async post<T>(path: string, { body, contentType }: RawBody, accessToken: string): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      [RequestHeader.INTERNAL_KEY]: this.internalKey,
      [RequestHeader.AUTHORIZATION]: `Bearer ${accessToken}`,
      ...(contentType !== undefined && { 'content-type': contentType }),
    };
    const response = await fetch(`${this.baseUrl}${path}`, { method: 'POST', headers, body });
    const text = await response.text();
    const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
    return { status: response.status, headers: response.headers, body: (isJson ? JSON.parse(text) : text) as T, text };
  }
}
