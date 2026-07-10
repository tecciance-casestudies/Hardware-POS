/**
 * Contracts for the QuickBooks Online OAuth 2.0 integration.
 */

export interface QuickBooksConnectionStatus {
  connected: boolean;
  realmId: string | null;
  environment: string | null;
  tokenExpiresAt: string | null;
}

/** Raw token response from the Intuit token endpoint. */
export interface QuickBooksTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
}

/** Query params on the OAuth redirect callback. */
export interface QuickBooksCallbackQuery {
  code?: string;
  state?: string;
  realmId?: string;
  error?: string;
  error_description?: string;
}
