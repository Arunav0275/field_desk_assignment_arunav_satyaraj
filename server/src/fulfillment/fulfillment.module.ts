import { Module } from '@nestjs/common';
import { FulfillmentService } from './fulfillment.service.js';
import { FulfillmentController } from './fulfillment.controller.js';
import { OrdersRepositoryModule } from '../orders/orders.repository.js';
import { FulfillmentRepositoryModule } from '../fulfillment/fulfillment.repository.js';
import { AccountsRepositoryModule } from '../accounts/accounts.repository.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { RewardsModule } from '../rewards/rewards.module.js';
import { CatalogRepositoryModule } from '../catalog/catalog.repository.js';
import { ReturnsRepositoryModule } from '../returns/returns.repository.js';
import { CreditsRepositoryModule } from '../credits/credits.repository.js';
import { RewardsRepositoryModule } from '../rewards/rewards.repository.js';
@Module({
  imports: [
    OrdersRepositoryModule,
    FulfillmentRepositoryModule,
    AccountsRepositoryModule,
    AccountsModule,
    RewardsModule,
    CatalogRepositoryModule,
    ReturnsRepositoryModule,
    CreditsRepositoryModule,
    RewardsRepositoryModule,
  ],
  controllers: [FulfillmentController],
  providers: [FulfillmentService],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
