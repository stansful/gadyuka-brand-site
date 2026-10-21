import { RequestHeader } from '~core/constants/request-header.enum';

export interface ApiRequestOptions {
  /** Sent as JSON */
  readonly body?: unknown;
  /** Sent as is with content-type application/json (malformed bodies) */
  readonly rawBody?: string;
  readonly headers?: Readonly<Record<string, string>>;
  /** Access token for `Authorization: Bearer …` */
  readonly accessToken?: string;
}

export interface ApiResponse<T = unknown> {
  readonly status: number;
  readonly headers: Headers;
  readonly body: T;
  readonly text: string;
}

/** fetch against the test app, as the Next.js server calls it (x-internal-key on every request). */
export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly internalKey: string,
  ) {}

  /** The same client without the internal key (a browser, or anyone else on the network). */
  withoutInternalKey(): ApiClient {
    return new ApiClient(this.baseUrl, '');
  }

  get<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, options);
  }

  head(path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<string>> {
    return this.request<string>('HEAD', path, options);
  }

  post<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, options);
  }

  put<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, options);
  }

  patch<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, options);
  }

  delete<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, options);
  }

  /** Any method ("GET", "POST" …): the route policy test calls every route this way. */
  async request<T>(method: string, path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headersOf(options),
      body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, body: this.parseBody<T>(response, text), text };
  }

  /** JSON answers parsed, anything else (empty, media bytes as text) as is. */
  private parseBody<T>(response: Response, text: string): T {
    const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
    return (isJson && text !== '' ? JSON.parse(text) : text) as T;
  }

  private headersOf(options: ApiRequestOptions): Record<string, string> {
    return {
      ...(this.internalKey !== '' && { [RequestHeader.INTERNAL_KEY]: this.internalKey }),
      ...((options.body !== undefined || options.rawBody !== undefined) && { 'content-type': 'application/json' }),
      ...(options.accessToken !== undefined && { [RequestHeader.AUTHORIZATION]: `Bearer ${options.accessToken}` }),
      ...options.headers,
    };
  }
}
