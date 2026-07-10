import { Injectable, NotImplementedException } from '@nestjs/common';
import { DEFAULT_CURRENCY } from '@hardware-pos/shared';

import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AppSettings } from './settings.interfaces';

/**
 * Placeholder settings service. Returns sensible defaults for now; persistence
 * (a per-tenant settings table) will be added later.
 */
@Injectable()
export class SettingsService {
  getSettings(_tenantId: string): AppSettings {
    return {
      currency: DEFAULT_CURRENCY,
      taxRatePercent: 0,
      taxInclusive: false,
      highDiscountThresholdPercent: 10,
      receiptFooter: 'Thank you for your purchase!',
    };
  }

  /** TODO: persist per-tenant settings. */
  updateSettings(_tenantId: string, _dto: UpdateSettingsDto): Promise<AppSettings> {
    throw new NotImplementedException('Updating settings is not implemented yet');
  }
}
