// src/subscriptions/schemas/promotion.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PromotionDocument = HydratedDocument<Promotion>;

type Scope = 'GLOBAL' | 'FEATURE' | 'PLAN_MODELS';
type PromoType = 'PERCENT' | 'FIXED';

@Schema({ timestamps: true })
export class Promotion {
  @Prop({ required: true, unique: true })
  code: string; // z.B. "PROJECT_START_10"

  @Prop({ required: true })
  label: string; // kurzer Badge-Text: "Launch -10%"

  @Prop()
  description?: string; // längerer Erklärungstext

  @Prop({ required: true, enum: ['PERCENT', 'FIXED'] })
  type: PromoType;

  @Prop({ required: true, min: 0 })
  value: number; // bei PERCENT = 10, bei FIXED = Euro-Betrag

  @Prop({ required: true, enum: ['GLOBAL', 'FEATURE', 'PLAN_MODELS'] })
  appliesTo: Scope;

  @Prop({ enum: ['PREMIUM', 'ENTERPRISE'] })
  feature?: 'PREMIUM' | 'ENTERPRISE'; // wenn appliesTo = FEATURE

  @Prop([String])
  planModels?: string[]; // wenn appliesTo = PLAN_MODELS (z.B. ['1_YEAR', '1_MONTH'])

  @Prop({ default: true })
  active?: boolean;

  @Prop()
  startAt?: Date;

  @Prop()
  endAt?: Date;

  @Prop({ default: 0 })
  priority?: number; // höhere Zahl = bevorzugen bei Überschneidung
}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);
