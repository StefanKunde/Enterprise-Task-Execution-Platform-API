import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MaintenanceDocument = Maintenance & Document;

@Schema({ timestamps: true })
export class Maintenance {
  @Prop({ default: false })
  isMaintenance: boolean;

  @Prop({ type: String, default: null })
  message: string | null;
}

export const MaintenanceSchema = SchemaFactory.createForClass(Maintenance);
