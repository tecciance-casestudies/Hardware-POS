/**
 * Generic API envelope types shared between the web client and the API.
 * Feature-specific request/response DTOs will live next to their modules.
 */

/** Standard success envelope. */
export interface ApiResponse<T> {
  data: T;
}

/** Standard error envelope returned by the API. */
export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

/** Cursor/offset pagination metadata. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
