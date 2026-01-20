// src/orders/orders.controller.ts
import {
  Body,
  Controller,
  Post,
  UseGuards,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { randomUUID } from 'crypto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CurrentUserData } from 'src/auth/types/current-user.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SubscriptionsService } from 'src/subscriptions/subscription.service';

// ✅ Paid-only union to match your CartItem in the Orders schema
type PaidPlanModel = '7_DAYS' | '14_DAYS' | '1_MONTH' | '1_YEAR' | 'AA_1_MONTH';

// Request cart items must be paid-only in /orders
type IncomingItem = {
  model: PaidPlanModel;
  feature: 'PREMIUM' | 'ENTERPRISE';
};

// What we persist in the order
type HydratedCartItem = {
  model: PaidPlanModel;
  feature: 'PREMIUM' | 'ENTERPRISE';
  label: string;
  durationInDays: number;
  costInEuro: number;
};

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    @Inject(SubscriptionsService) private readonly subs: SubscriptionsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() body: { cart: IncomingItem[] },
    @CurrentUser() user: CurrentUserData,
  ) {
    const userId = user.id;
    const incoming: IncomingItem[] = Array.isArray(body.cart) ? body.cart : [];
    if (!incoming.length) throw new BadRequestException('Empty cart');

    // ❌ Trial must not be ordered; it’s activated on the pricing page
    // If the client ever sends it, block the request.
    if ((body.cart ?? []).some((i: any) => i?.model === 'TRIAL_1_DAY')) {
      throw new BadRequestException(
        'Trial plan cannot be ordered. Activate it from the pricing page.',
      );
    }

    const hydrated: HydratedCartItem[] = [];
    for (const it of incoming) {
      const { plan, finalPrice } = await this.subs.getPlanWithFinalPrice(
        it.model,
        it.feature,
      );

      // Extra safety: if plan is trial or price is 0, reject
      if ((plan as any)?.isTrial || finalPrice <= 0) {
        throw new BadRequestException(
          'Free or trial plans cannot be ordered. Activate them directly.',
        );
      }

      // ✅ Now safe to assert the paid model to match schema typings
      hydrated.push({
        model: plan.model as PaidPlanModel,
        feature: plan.feature,
        label: plan.label,
        durationInDays: plan.durationInDays,
        costInEuro: Math.round(finalPrice * 100) / 100,
      });
    }

    const euroTotal =
      Math.round(hydrated.reduce((s, i) => s + (i.costInEuro ?? 0), 0) * 100) /
      100;
    if (euroTotal <= 0) throw new BadRequestException('Empty cart');

    const orderId = randomUUID();
    await this.orders.create({
      orderId,
      userId,
      cart: hydrated, // ✅ type now matches CartItem[] in your schema
      euroTotal,
      status: 'pending',
    });

    return { orderId };
  }
}
