import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type SubscriptionDocument = HydratedDocument<Subscription>;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  model:
    | 'TRIAL'
    | 'BASIC'
    | 'PRO'
    | 'ENTERPRISE';

  @Prop({ required: true })
  costInEuro: number;

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ required: true, enum: ['PREMIUM', 'ENTERPRISE'] })
  feature: 'PREMIUM' | 'ENTERPRISE';

  @Prop({ default: false })
  isTrial?: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
SubscriptionSchema.index({ userId: 1, isTrial: 1 });
