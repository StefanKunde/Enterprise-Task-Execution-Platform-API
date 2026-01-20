import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { NowPaymentsService } from './now.service';
import { SubscriptionsService } from 'src/subscriptions/subscription.service';

@Controller('payments/now')
export class PaymentsNowController {
  constructor(
    private readonly orders: OrdersService,
    private readonly nowPay: NowPaymentsService,
    @Inject(SubscriptionsService) private readonly subs: SubscriptionsService,
  ) {}

  @Post('ipn')
  async ipn(@Body() payload: any, @Headers('x-nowpayments-sig') sig?: string) {
    if (!this.nowPay.verifyIpnSignature(payload, sig)) return 'bad sig';

    const { payment_status, order_id } = payload;
    const map: Record<string, any> = {
      confirming: 'confirming',
      confirmed: 'confirming',
      finished: 'finished',
      failed: 'failed',
      expired: 'expired',
      partially_paid: 'partially_paid',
    };
    const status = map[payment_status] || null;

    const order = await this.orders.findByOrderId(order_id);
    if (!order) return 'ok';

    if (status && order.status !== status) {
      await this.orders.setStatus(order.orderId, status);
    }

    // Only activate on 'finished' status and only once
    if (status === 'finished' && !order.activatedAt) {
      // Create or extend subscription for each cart item
      for (const item of order.cart) {
        await this.subs.createOrExtendSubscription(
          order.userId,
          item.model, // '7_DAYS'|'14_DAYS'|'1_MONTH'|'1_YEAR'
          item.feature,
        );
      }
      await this.orders.markActivated(order.orderId);
    }
    return 'ok';
  }

  @Post('create')
  async createPayment(
    @Body()
    body: {
      orderId: string;
      payCurrency: 'btc' | 'eth' | 'ltc' | 'sol' | 'usdterc20' | 'usdttrc20';
    },
  ) {
    const order = await this.orders.findByOrderId(body.orderId);
    if (!order) throw new Error('Order not found');

    const description = order.cart
      .map((i) => `${i.label} (${i.feature} ${i.durationInDays}d)`)
      .join(' + ');
    const successUrl = `${process.env.PUBLIC_BASE_URL}/checkout/success?order=${order.orderId}`;
    const cancelUrl = `${process.env.PUBLIC_BASE_URL}/checkout/failed?order=${order.orderId}`;
    const ipnUrl = `${process.env.PUBLIC_BASE_URL}/payments/now/ipn`;

    const payment = await this.nowPay.createPayment({
      orderId: order.orderId,
      euroTotal: order.euroTotal,
      description,
      payCurrency: body.payCurrency,
      successUrl,
      cancelUrl,
      ipnUrl,
    });

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 20 * 60 * 1000);

    await this.orders.setPayment(order.orderId, {
      paymentId: payment.payment_id,
      paymentCreatedAt: createdAt,
      paymentExpiresAt: expiresAt,
      payCurrency: body.payCurrency,
      payAddress: payment.pay_address,
      payAmount: payment.pay_amount,
    });

    return {
      paymentId: payment.payment_id,
      payAmount: payment.pay_amount,
      payAddress: payment.pay_address,
      payCurrency: body.payCurrency,
      priceAmount: order.euroTotal,
      priceCurrency: 'EUR',
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      orderId: order.orderId,
    };
  }

  @Get('status/:paymentId')
  async status(@Param('paymentId') paymentId: string) {
    const pid = Number(paymentId);

    // Narrow to a non-null variable and keep that reference
    const found = await this.orders.findByPaymentId(pid);
    if (!found) return { error: 'unknown payment' };

    // From here on, 'order' is guaranteed non-null for TS
    let order = found as any;

    const isFinal = ['finished', 'failed', 'expired'].includes(order.status);
    if (!isFinal) {
      try {
        const remote = await this.nowPay.getPaymentStatus(pid);

        const map: Record<string, typeof order.status> = {
          waiting: 'pending',
          confirming: 'confirming',
          confirmed: 'confirming',
          partially_paid: 'partially_paid',
          finished: 'finished',
          failed: 'failed',
          expired: 'expired',
        };

        const next = map[remote?.payment_status as string];
        if (next && next !== order.status) {
          await this.orders.setStatus(order.orderId, next);
          order = { ...order, status: next }; // safe (order is non-null)
        }

        // Idempotent activation
        if (order.status === 'finished' && !order.activatedAt) {
          for (const item of order.cart) {
            await this.subs.createOrExtendSubscription(
              order.userId,
              item.model,
              item.feature,
            );
          }
          await this.orders.markActivated(order.orderId);
          order.activatedAt = new Date();
        }
      } catch {
        // ignore remote errors, return last known DB state
      }
    }

    return {
      status: order.status,
      orderId: order.orderId,
      payCurrency: order.payCurrency,
      payAddress: order.payAddress,
      payAmount: order.payAmount,
      createdAt: order.paymentCreatedAt?.toISOString?.(),
      expiresAt: order.paymentExpiresAt?.toISOString?.(),
      serverTime: new Date().toISOString(),
    };
  }
}
