// src/users/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export class ExecutorConfig {
  sessionId!: string;
  filterItems!: string[];
  maxThreshold!: number;
  minThreshold!: number;
  maxVariance!: number;
  filterByCategory?: boolean;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  username: string;

  @Prop({ required: false, type: String })
  email?: string | null;

  // --- NEW: Discord linkage fields ---------------------------------
  @Prop({ unique: true, sparse: true })
  discordId?: string;

  @Prop()
  discordUsername?: string;

  @Prop()
  discordLinkedAt?: Date;

  @Prop()
  discordJoinVerifiedAt?: Date;
  // ------------------------------------------------------------------

  @Prop({ type: Object, required: false })
  executorConfig?: ExecutorConfig;

  @Prop({ type: Date })
  executorConfigUpdatedAt?: Date;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ type: String, default: null })
  emailVerificationToken?: string | null;

  @Prop({ type: Date, default: null })
  emailVerificationExpires?: Date | null;

  @Prop({ required: false, type: String })
  password?: string | null;

  @Prop({ type: String, default: null })
  passwordResetToken?: string | null;

  @Prop({ type: Date, default: null })
  passwordResetExpires?: Date | null;

  @Prop()
  refreshToken?: string;

  @Prop()
  notificationId?: string;

  // --- Platform Integration Fields ----------------------------
  @Prop({ unique: true, sparse: true })
  platformId?: string; // External platform user ID

  @Prop()
  platformAvatar?: string; // Avatar image URL from platform

  @Prop()
  platformDisplayName?: string; // Display name from platform

  @Prop()
  platformProfileUrl?: string; // Profile URL on platform

  @Prop()
  platformTransferUrl?: string; // Transfer URL for platform

  @Prop()
  platformWebToken?: string; // Platform web authentication token

  @Prop({ type: Date })
  platformWebTokenSavedAt?: Date; // When the web token was saved

  @Prop({ type: Date })
  platformWebTokenExpiresAt?: Date; // When the web token expires
  // ------------------------------------------------------------------

  // --- API Token Fields ---------------------------------------------
  @Prop()
  apiToken?: string; // Platform API token

  @Prop({ type: Date })
  apiTokenSavedAt?: Date; // When API token was saved

  @Prop({ type: Date })
  apiTokenExpiresAt?: Date; // When API token expires
  // ------------------------------------------------------------------

  // --- System Configuration Fields --------------------------------------------
  @Prop()
  externalId?: string; // Legacy external ID field

  @Prop()
  lastUsedCookies?: string; // Last used session cookies

  @Prop({ type: Date })
  lastUsedCookiesUpdatedAt?: Date; // When cookies were last updated

  @Prop({ type: Number, default: 0 })
  lastKnownBalance?: number; // Last known account balance

  @Prop({ default: false })
  isCurrentlyUsingSystem?: boolean; // Whether system is currently active

  @Prop({ type: String })
  proxy?: string; // Proxy configuration reference

  @Prop({ type: Object })
  filterJson?: any; // Filter configuration for executor

  @Prop({ default: false })
  isMasterUser?: boolean; // Master user flag

  @Prop({ default: false })
  isSuperUser?: boolean; // Super user flag
  // ------------------------------------------------------------------
}

export type UserDocument = Document & { _id: Types.ObjectId } & User;
export const UserSchema = SchemaFactory.createForClass(User);

// Indexes for executor tracking
UserSchema.index({ 'executorConfig.executionId': 1 });
