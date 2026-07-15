import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AuthenticatedUser, AuthTokenResult } from './auth.types';
import { AuthService, CurrentUserView } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Email + password login (owner / admin / accountant). */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthTokenResult> {
    return this.authService.login(dto);
  }

  /** PIN login (cashier / manager). Tenant comes from the x-tenant-id header. */
  @Public()
  @Post('pin-login')
  @HttpCode(HttpStatus.OK)
  pinLogin(@TenantId() tenantId: string, @Body() dto: PinLoginDto): Promise<AuthTokenResult> {
    return this.authService.pinLogin(tenantId, dto);
  }

  /**
   * Exchange a refresh token for a fresh access + refresh pair (rotation).
   * Public: this is exactly the call made once the access token has expired.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokenResult> {
    return this.authService.refresh(dto.refreshToken);
  }

  /** Revoke a refresh token on sign-out. Public so an expired session can still sign out. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.authService.logout(dto.refreshToken);
  }

  /** The authenticated user plus their effective permissions. */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<CurrentUserView> {
    return this.authService.getCurrentUser(user.id);
  }
}
