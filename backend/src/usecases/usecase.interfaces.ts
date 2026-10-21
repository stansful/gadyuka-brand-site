export interface Usecase<Dto = void, Response = unknown> {
  execute(dto: Dto): Promise<Response> | Response;
}

type ApiVersion = `/api/v${number}`;

export const API_VERSION: ApiVersion = '/api/v1';
