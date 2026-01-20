import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SubscriptionPlanDocument = HydratedDocument<SubscriptionPlan>;

@Schema()
export class SubscriptionPlan {
  @Prop({ required: true, unique: true })
  model:
    | 'TRIAL'
    | 'BASIC'
    | 'PRO'
    | 'ENTERPRISE';

  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  costInEuro: number;

  @Prop({ required: true })
  durationInDays: number;

  @Prop({ required: true, enum: ['PREMIUM', 'ENTERPRISE'] })
  feature: 'PREMIUM' | 'ENTERPRISE';

  @Prop({ default: false })
  highlight?: boolean;

  @Prop({ default: false })
  isTrial?: boolean;
}

export const SubscriptionPlanSchema =
  SchemaFactory.createForClass(SubscriptionPlan);
