import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Schema as MongooseSchema } from 'mongoose';

// Define ExecutionItem schema
const ExecutionItemSchema = new MongooseSchema({
  itemName: { type: String, required: true },
  value: { type: Number, required: true },
  iconUrl: { type: String },
}, { _id: false });

// TypeScript interface for type safety
export interface ExecutionItem {
  itemName: string;
  value: number;
  iconUrl?: string;
}

export type ExecutionDocument = Execution & Document;

@Schema({ timestamps: true })
export class Execution {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  executionId!: string;

  @Prop({ required: true })
  status!: string;

  @Prop({ default: false, index: true })
  isHistorical!: boolean;

  @Prop({ default: false, index: true })
  isSystemProcessed!: boolean;

  @Prop({ type: String, enum: ['INBOUND', 'OUTBOUND'], index: true })
  transactionType?: 'INBOUND' | 'OUTBOUND';

  // Initial data
  @Prop({ type: Date, required: true })
  initiatedAt!: Date;

  // Final data
  @Prop({ type: Date })
  updatedAt?: Date | null;

  @Prop({ type: String })
  cancelReason?: string | null;

  // Common fields
  @Prop({ required: true })
  totalAmount!: number;

  @Prop({ required: true })
  marginPercent!: number;

  @Prop({ type: [ExecutionItemSchema], required: true })
  items!: ExecutionItem[];

  @Prop({ type: Date })
  finalizedAt?: Date | null;

  // Matching fields (for tracking inbound → outbound)
  @Prop({ type: String })
  matchedToOutboundId?: string;

  @Prop({ type: String })
  matchedToInboundId?: string;

  @Prop({ type: Number })
  realizedValue?: number;

  // Manual adjustment fields
  @Prop({ type: Boolean, default: false })
  isManuallyAdjusted!: boolean;

  @Prop({ type: String, enum: ['system', 'manual', null], default: null })
  manualSource?: 'system' | 'manual' | null;

  @Prop({ type: Number })
  manualInboundValue?: number;

  @Prop({ type: Date })
  manualInboundDate?: Date;

  @Prop({ type: Number })
  manualOutboundValue?: number;

  @Prop({ type: Date })
  manualOutboundDate?: Date;

  @Prop({ type: String })
  userNotes?: string;
}

export const ExecutionSchema = SchemaFactory.createForClass(Execution);

// Indexes for performance
// executionId unique index is created by @Prop({ unique: true })
ExecutionSchema.index({ userId: 1, createdAt: -1 });
ExecutionSchema.index({ isHistorical: 1, isSystemProcessed: 1 });
ExecutionSchema.index({ status: 1, finalizedAt: 1 });
// matchedToOutboundId and matchedToInboundId indexes are created above
ExecutionSchema.index({ transactionType: 1, status: 1 });
