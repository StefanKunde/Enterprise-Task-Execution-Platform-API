import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ExecutionHistory {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, unique: true })
  executionId: string;

  @Prop() itemName: string;
  @Prop() iconUrl: string;
  @Prop() transactionType: string;
  @Prop() amount: number;
  @Prop() marginPercent: number;
  @Prop() status: string;
  @Prop() completed: boolean;
  @Prop() createdAt: string;
  @Prop() updatedAt: string;

  @Prop({ default: false })
  acquiredBySystem: boolean;
}

export type ExecutionHistoryDocument = ExecutionHistory & Document;
export const ExecutionHistorySchema = SchemaFactory.createForClass(ExecutionHistory);
