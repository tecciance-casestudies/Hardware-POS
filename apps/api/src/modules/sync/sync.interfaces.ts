/** Result of enqueueing an inbound catalog refresh. */
export interface RefreshResult {
  started: boolean;
}

/** Result of re-enqueueing a failed outbound sync. */
export interface RetryResult {
  id: string;
  syncStatus: string;
}
