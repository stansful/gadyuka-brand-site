import { MediaHttpExchange } from '~module/storage';

export interface MediaDto {
  /** The requested path after /media/ */
  readonly path: string;
  /** Passed through to the file server untouched (it streams the answer). */
  readonly http: MediaHttpExchange;
}
