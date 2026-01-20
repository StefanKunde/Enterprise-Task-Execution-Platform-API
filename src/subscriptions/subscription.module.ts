import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Subscription,
  SubscriptionSchema,
} from './entities/subscription.schema';
import { SubscriptionsService } from './subscription.service';
import { UsersModule } from 'src/users/users.module';
import { SubscriptionsController } from './subscriptions.controller';
import {
  SubscriptionPlan,
  SubscriptionPlanSchema,
} from './entities/subscription-plan.schema';
import { Promotion, PromotionSchema } from './entities/promotion.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
      { name: Promotion.name, schema: PromotionSchema },
    ]),
    forwardRef(() => UsersModule),
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
