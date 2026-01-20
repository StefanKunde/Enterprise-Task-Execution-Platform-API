// src/orders/schema/order.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ _id: false })
class CartItem {
  @Prop({ required: true })
  model: '7_DAYS' | '14_DAYS' | '1_MONTH' | '1_YEAR' | 'AA_1_MONTH';

  @Prop({ required: true, enum: ['PREMIUM', 'ENTERPRISE'] })
  feature: 'PREMIUM' | 'ENTERPRISE';

  @Prop({ required: true }) label: string;
  @Prop({ required: true }) costInEuro: number;
  @Prop({ required: true }) durationInDays: number;
}
export const CartItemSchema = SchemaFactory.createForClass(CartItem);

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, unique: true }) orderId: string;
  @Prop({ required: true, index: true }) userId: string;
  @Prop({ type: [CartItemSchema], required: true }) cart: CartItem[];
  @Prop({ required: true }) euroTotal: number;

  @Prop({
    required: true,
    enum: [
      'pending',
      'confirming',
      'finished',
      'failed',
      'expired',
      'partially_paid',
    ],
    default: 'pending',
  })
  status:
    | 'pending'
    | 'confirming'
    | 'finished'
    | 'failed'
    | 'expired'
    | 'partially_paid';

  @Prop() paymentId?: number;
  @Prop() paymentCreatedAt?: Date;
  @Prop() paymentExpiresAt?: Date;
  @Prop() payCurrency?:
    | 'btc'
    | 'eth'
    | 'ltc'
    | 'sol'
    | 'usdterc20'
    | 'usdttrc20';
  @Prop() payAddress?: string;
  @Prop() payAmount?: number;
  @Prop() activatedAt?: Date;
}
export const OrderSchema = SchemaFactory.createForClass(Order);
// orderId unique index is created by @Prop({ unique: true })
OrderSchema.index({ userId: 1, createdAt: -1 });
