import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BalanceUpdateDocument = BalanceUpdate & Document;

@Schema({ timestamps: true })
export class BalanceUpdate {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  balance!: number;

  @Prop({ required: true })
  updateReason!: string;

  @Prop({ type: Date, required: true, index: true })
  updatedAt!: Date;
}

export const BalanceUpdateSchema = SchemaFactory.createForClass(BalanceUpdate);

// Indexes for performance
BalanceUpdateSchema.index({ userId: 1, updatedAt: -1 });
