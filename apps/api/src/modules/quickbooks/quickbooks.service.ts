import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { decryptSecret, encryptSecret } from '../../common/crypto';
import { QBO_SCOPE, QuickBooksConfig } from './quickbooks.config';
import { QuickBooksRepository } from './quickbooks.repository';
import {
  QuickBooksCallbackQuery,
  QuickBooksConnectionStatus,
  QuickBooksTokenResponse,
} from './quickbooks.interfaces';

interface OAuthStatePayload {
  typ: 'qbo-oauth';
  tenantId: string;
}

/** Refresh the access token when it is within this window of expiring. */
const REFRESH_BUFFER_MS = 60_000;

@Injectable()
export class QuickBooksService {
  private readonly logger = new Logger(QuickBooksService.name);

  constructor(
    private readonly config: QuickBooksConfig,
    private readonly repository: QuickBooksRepository,
    private readonly jwtService: JwtService,
  ) {}

  // ── connect ──────────────────────────────────────────────────────────────

  /** Build the Intuit authorization URL to redirect the admin to. */
  async getAuthorizationUrl(tenantId: string): Promise<string> {
    const cfg = this.config.resolve();
    const state = await this.jwtService.signAsync(
      { typ: 'qbo-oauth', tenantId } satisfies OAuthStatePayload,
      { expiresIn: '10m' },
    );
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      response_type: 'code',
      scope: QBO_SCOPE,
      redirect_uri: cfg.redirectUri,
      state,
    });
    return `${cfg.authorizeUrl}?${params.toString()}`;
  }

  // ── callback ─────────────────────────────────────────────────────────────

  /**
   * Handle the OAuth redirect: verify state, exchange the code for tokens, store
   * them encrypted, and return the frontend URL to redirect the browser to.
   * Always returns a redirect target (errors are surfaced as query params).
   */
  async handleCallback(query: QuickBooksCallbackQuery): Promise<string> {
    const cfg = this.config.resolve();
    const frontend = `${cfg.webOrigin}/quickbooks`;

    try {
      if (query.error) {
        throw new BadRequestException(query.error_description ?? query.error);
      }
      if (!query.code || !query.state || !query.realmId) {
        throw new BadRequestException('Missing code, state, or realmId');
      }

      const tenantId = this.verifyState(query.state);
      const tokens = await this.exchangeCode(query.code);
      await this.persistTokens(tenantId, query.realmId, tokens, cfg.environment, cfg.encryptionKey);

      this.logger.log(`QuickBooks connected for tenant ${tenantId} (realm ${query.realmId})`);
      return `${frontend}?connected=1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'connection_failed';
      this.logger.warn(`QuickBooks callback failed: ${message}`);
      return `${frontend}?error=${encodeURIComponent(message)}`;
    }
  }

  // ── disconnect ───────────────────────────────────────────────────────────

  async disconnect(tenantId: string): Promise<{ disconnected: boolean }> {
    const connection = await this.repository.find(tenantId);
    if (connection) {
      const cfg = this.config.resolve();
      try {
        const refreshToken = decryptSecret(connection.refreshToken, cfg.encryptionKey);
        await this.revokeToken(refreshToken);
      } catch (err) {
        // Best-effort revoke; always remove the local connection.
        this.logger.warn(`QuickBooks token revoke failed: ${(err as Error).message}`);
      }
      await this.repository.delete(tenantId);
    }
    return { disconnected: true };
  }

  // ── status ───────────────────────────────────────────────────────────────

  async getConnectionStatus(tenantId: string): Promise<QuickBooksConnectionStatus> {
    const connection = await this.repository.find(tenantId);
    if (!connection || !connection.isActive) {
      return { connected: false, realmId: null, environment: null, tokenExpiresAt: null };
    }
    return {
      connected: true,
      realmId: connection.realmId,
      environment: connection.environment,
      tokenExpiresAt: connection.accessTokenExpiresAt?.toISOString() ?? null,
    };
  }

  // ── access token (refresh logic) ───────────────────────────────────────────

  /**
   * Return a valid access token for a tenant, refreshing it if it is expired or
   * about to expire. Internal only — tokens are never returned to the frontend.
   */
  async getValidAccessToken(tenantId: string): Promise<string> {
    const cfg = this.config.resolve();
    const connection = await this.repository.find(tenantId);
    if (!connection || !connection.isActive) {
      throw new NotFoundException('QuickBooks is not connected');
    }

    const expiresAt = connection.accessTokenExpiresAt?.getTime() ?? 0;
    if (Date.now() < expiresAt - REFRESH_BUFFER_MS) {
      return decryptSecret(connection.accessToken, cfg.encryptionKey);
    }

    const refreshToken = decryptSecret(connection.refreshToken, cfg.encryptionKey);
    const tokens = await this.refreshTokens(refreshToken);
    const now = Date.now();
    await this.repository.updateTokens(tenantId, {
      accessTokenEnc: encryptSecret(tokens.access_token, cfg.encryptionKey),
      refreshTokenEnc: encryptSecret(tokens.refresh_token, cfg.encryptionKey),
      accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
      refreshTokenExpiresAt: new Date(now + tokens.x_refresh_token_expires_in * 1000),
    });
    return tokens.access_token;
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private verifyState(state: string): string {
    let payload: OAuthStatePayload;
    try {
      payload = this.jwtService.verify<OAuthStatePayload>(state);
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }
    if (payload.typ !== 'qbo-oauth' || !payload.tenantId) {
      throw new UnauthorizedException('Invalid OAuth state');
    }
    return payload.tenantId;
  }

  private async persistTokens(
    tenantId: string,
    realmId: string,
    tokens: QuickBooksTokenResponse,
    environment: string,
    encryptionKey: string,
  ): Promise<void> {
    const now = Date.now();
    await this.repository.upsert(tenantId, {
      realmId,
      accessTokenEnc: encryptSecret(tokens.access_token, encryptionKey),
      refreshTokenEnc: encryptSecret(tokens.refresh_token, encryptionKey),
      tokenType: tokens.token_type,
      accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
      refreshTokenExpiresAt: new Date(now + tokens.x_refresh_token_expires_in * 1000),
      environment,
    });
  }

  private exchangeCode(code: string): Promise<QuickBooksTokenResponse> {
    const cfg = this.config.resolve();
    return this.tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: cfg.redirectUri,
    });
  }

  private refreshTokens(refreshToken: string): Promise<QuickBooksTokenResponse> {
    return this.tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  private async tokenRequest(body: Record<string, string>): Promise<QuickBooksTokenResponse> {
    const cfg = this.config.resolve();
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');

    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(body).toString(),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadRequestException(`QuickBooks token request failed (${res.status}): ${detail}`);
    }
    return (await res.json()) as QuickBooksTokenResponse;
  }

  private async revokeToken(token: string): Promise<void> {
    const cfg = this.config.resolve();
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
    await fetch(cfg.revokeUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ token }),
    });
  }
}
