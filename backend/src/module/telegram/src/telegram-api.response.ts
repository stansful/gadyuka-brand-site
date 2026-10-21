/** The fields of a Bot API answer the transport reads. */
export interface TelegramApiResponse {
  readonly ok: boolean;
  readonly description?: string;
  readonly retryAfterSeconds?: number;
}

/** Reads a Bot API answer body without trusting its shape (anything unexpected → undefined). */
export class TelegramApiResponseParser {
  async read(response: Response): Promise<TelegramApiResponse | undefined> {
    try {
      return this.parse(await response.json());
    } catch {
      return undefined;
    }
  }

  parse(body: unknown): TelegramApiResponse | undefined {
    if (typeof body !== 'object' || body === null || !('ok' in body) || typeof body.ok !== 'boolean') {
      return undefined;
    }
    const description = 'description' in body && typeof body.description === 'string' ? body.description : undefined;
    return { ok: body.ok, description, retryAfterSeconds: this.retryAfterOf(body) };
  }

  private retryAfterOf(body: object): number | undefined {
    if (!('parameters' in body) || typeof body.parameters !== 'object' || body.parameters === null) {
      return undefined;
    }
    const { parameters } = body;
    return 'retry_after' in parameters && typeof parameters.retry_after === 'number'
      ? parameters.retry_after
      : undefined;
  }
}
