import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * Root application module.
 *
 * Feature modules (auth, products, sales, customers, payments, quickbooks-sync)
 * will be registered here as they are built.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
