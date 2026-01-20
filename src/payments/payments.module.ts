// payments/payments.module.ts
import { Module } from '@nestjs/common';
import { NowPaymentsService } from './now.service';
import { PaymentsNowController } from './payments-now.controller';
import { OrdersModule } from 'src/orders/orders.module';
import { SubscriptionsModule } from 'src/subscriptions/subscription.module';

@Module({
  imports: [OrdersModule, SubscriptionsModule],
  providers: [NowPaymentsService],
  controllers: [PaymentsNowController],
})
export class PaymentsModule {}
