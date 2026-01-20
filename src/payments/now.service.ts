// payments/now.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class NowPaymentsService {
  private base = process.env.NOWPAYMENTS_BASE!;
  private apiKey = process.env.NOWPAYMENTS_API_KEY!;
  private ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET!;

  async createPayment(args: {
    orderId: string;
    euroTotal: number;
    description: string;
    payCurrency: 'btc' | 'eth' | 'ltc' | 'sol' | 'usdterc20' | 'usdttrc20';
    successUrl: string;
    cancelUrl: string;
    ipnUrl: string;
  }) {
    const body = {
      price_amount: +args.euroTotal.toFixed(2),
      price_currency: 'eur',
      pay_currency: args.payCurrency,
      order_id: args.orderId,
      order_description: args.description,
      ipn_callback_url: args.ipnUrl,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    };
    const res = await axios.post(`${this.base}/v1/payment`, body, {
      headers: { 'x-api-key': this.apiKey },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return res.data; // includes payment_id, pay_address, pay_amount, etc.
  }

  verifyIpnSignature(payload: any, signature?: string): boolean {
    if (!signature) return false;
    const sorted = JSON.stringify(payload, Object.keys(payload).sort());
    const hmac = crypto
      .createHmac('sha512', this.ipnSecret)
      .update(sorted)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  /** Best-Practice: Live-Status von NOWPayments holen (Polling/Resync) */
  async getPaymentStatus(paymentId: number) {
    const url = `${this.base}/v1/payment/${paymentId}`;
    const res = await axios.get(url, { headers: { 'x-api-key': this.apiKey } });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return res.data; // enthält payment_status etc.
  }
}
