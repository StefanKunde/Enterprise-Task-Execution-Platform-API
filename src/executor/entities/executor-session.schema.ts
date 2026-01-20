// src/executor/schemas/executor-session.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExecutorSessionDocument = ExecutorSession & Document;

@Schema({ timestamps: true })
export class ExecutorSession {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true, type: String })
  userId!: string;

  @Prop({
    type: String,
    enum: ['waiting', 'running', 'stopped'],
    default: 'waiting',
    index: true,
  })
  status!: 'waiting' | 'running' | 'stopped';

  @Prop({ type: String, default: null })
  instanceRef!: string | null;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  stoppedAt?: Date;

  @Prop({ type: String })
  stoppedReason?: string;

  // Scheduling fields
  @Prop({ type: Date, default: null, index: true })
  scheduledStopAt!: Date | null;

  @Prop({ type: String, enum: ['start', 'stop'], default: 'start' })
  lastAction!: 'start' | 'stop';

  @Prop({ type: Date })
  lastActionAt?: Date;
}

export const ExecutorSessionSchema = SchemaFactory.createForClass(ExecutorSession);
