import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'hardware-pos-api',
      timestamp: new Date().toISOString(),
    };
  }
}
