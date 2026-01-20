import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  async create(data: Partial<Order>) {
    return this.orderModel.create(data);
  }

  async findByOrderId(orderId: string) {
    return this.orderModel.findOne({ orderId }).lean();
  }

  async findByPaymentId(paymentId: number) {
    return this.orderModel.findOne({ paymentId }).lean();
  }

  async setPayment(
    orderId: string,
    data: {
      paymentId: number;
      paymentCreatedAt: Date;
      paymentExpiresAt: Date;
      payCurrency: 'btc' | 'eth' | 'ltc' | 'sol' | 'usdterc20' | 'usdttrc20';
      payAddress?: string;
      payAmount?: number;
    },
  ) {
    await this.orderModel
      .updateOne(
        { orderId },
        {
          $set: {
            paymentId: data.paymentId,
            paymentCreatedAt: data.paymentCreatedAt,
            paymentExpiresAt: data.paymentExpiresAt,
            payCurrency: data.payCurrency,
            payAddress: data.payAddress,
            payAmount: data.payAmount,
          },
        },
      )
      .exec();
  }

  async setStatus(orderId: string, status: Order['status']) {
    await this.orderModel.updateOne({ orderId }, { $set: { status } }).exec();
  }

  /** Idempotenz-Flag setzen – nur wenn noch nicht gesetzt */
  async markActivated(orderId: string) {
    const r = await this.orderModel
      .updateOne(
        { orderId, activatedAt: { $exists: false } },
        { $set: { activatedAt: new Date() } },
      )
      .exec();
    return r.modifiedCount > 0;
  }
}
