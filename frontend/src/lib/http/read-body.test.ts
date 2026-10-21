import { describe, expect, it } from 'vitest';

import { BodyTooLargeError, readBodyBytes } from './read-body';

/** A request whose body is streamed without Content-Length (like a chunked upload). */
function streamingRequest(chunks: Uint8Array[], contentType = 'application/octet-stream'): Request {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Request('http://localhost/upload', {
    method: 'POST',
    body,
    headers: { 'content-type': contentType },
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

describe('readBodyBytes', () => {
  it('returns the whole body under the limit', async () => {
    const bytes = await readBodyBytes(streamingRequest([new Uint8Array([1, 2]), new Uint8Array([3])]), 3);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it('aborts a streamed body without Content-Length as soon as it exceeds the limit', async () => {
    const chunk = new Uint8Array(1024);
    await expect(readBodyBytes(streamingRequest([chunk, chunk, chunk]), 2000)).rejects.toBeInstanceOf(
      BodyTooLargeError,
    );
  });

  it('rejects early on a declared Content-Length above the limit', async () => {
    const request = new Request('http://localhost/upload', {
      method: 'POST',
      body: 'x'.repeat(10),
      headers: { 'content-length': '10' },
    });
    await expect(readBodyBytes(request, 5)).rejects.toBeInstanceOf(BodyTooLargeError);
  });
});
