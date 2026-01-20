import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { ExecutorConfig, User, UserDocument } from './entities/user.schema';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { MailService } from 'src/mail/mail.service';
import { ChangePasswordDto } from 'src/auth/dto/change-password.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
    private readonly mailService: MailService,
  ) {
    console.warn('[UsersService] constructor called');
    this.logger.setContext(UsersService.name);

    const mongoUri = this.configService.get<string>('MONGO_URI');
    this.logger.info('Mongo URI: %s', mongoUri);
    this.logger.info('Initializing user service');
  }

  onModuleInit() {
    console.warn('[UsersService] onModuleInit called');
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: new RegExp(`^${email}$`, 'i') })
      .exec();
  }

  async findMasterUser(): Promise<UserDocument | null> {
    return this.userModel.findOne({ isMasterUser: true }).exec();
  }

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const createdUser = new this.userModel(dto);
    this.logger.info('Creating new user with email: %s', dto.email);
    return createdUser.save();
  }

  async updateUserConfig(userId: string, cookies: string) {
    const user = await this.userModel.findById(userId).exec();
    if (user) {
      user.lastUsedCookies = cookies;
      user.lastUsedCookiesUpdatedAt = new Date();
      await user.save();
      return user;
    }
    throw new Error('User not found');
  }

  async update(
    userId: string,
    updateData: Partial<User>,
  ): Promise<UserDocument> {
    const updated = await this.userModel.findByIdAndUpdate(userId, updateData, {
      new: true,
    });

    if (!updated) {
      throw new NotFoundException(
        `Benutzer mit ID ${userId} wurde nicht gefunden`,
      );
    }

    return updated;
  }

  async updateRefreshToken(
    userId: string | Types.ObjectId,
    hashedToken: string | null,
  ) {
    await this.userModel.updateOne(
      { _id: userId },
      { refreshToken: hashedToken },
    );
  }

  async findByExternalId(externalId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ externalId });
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({
      username: new RegExp(`^${username}$`, 'i'),
    });
  }

  async findByPlatformId(platformId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ platformId }).exec();
  }

  async setApiToken(userId: string, token: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    let expiresAt: Date | undefined = undefined;

    try {
      const decoded: any = jwt.decode(token);
      if (decoded?.exp) {
        expiresAt = new Date(decoded.exp * 1000); // exp is in seconds
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      console.warn('⚠️ Invalid token when decoding');
    }

    user.apiToken = token;
    user.apiTokenSavedAt = new Date();
    user.apiTokenExpiresAt = expiresAt;

    await user.save();
    return { success: true, expiresAt };
  }

  isApiTokenExpired(expiresAt?: Date): boolean {
    return !expiresAt || Date.now() > new Date(expiresAt).getTime();
  }

  async setPlatformWebToken(userId: string, token: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    let expiresAt: Date | undefined = undefined;

    try {
      const decoded: any = jwt.decode(token);
      if (decoded?.exp) {
        expiresAt = new Date(decoded.exp * 1000); // `exp` is in seconds
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      console.warn('⚠️ Invalid token when decoding');
    }

    user.platformWebToken = token;
    user.platformWebTokenSavedAt = new Date();
    user.platformWebTokenExpiresAt = expiresAt;

    await user.save();
    return { success: true, expiresAt };
  }

  async updatePlatformTransferUrl(
    userId: string,
    transferUrl: string,
  ): Promise<UserDocument> {
    if (!userId || !transferUrl) {
      throw new BadRequestException('Missing userId or transferUrl');
    }

    const platformTransferUrlRegex =
      /^https:\/\/[a-zA-Z0-9.-]+\.com\/tradeoffer\/new\/\?partner=\d+&token=[a-zA-Z0-9_-]+$/;

    if (!platformTransferUrlRegex.test(transferUrl)) {
      throw new BadRequestException('Invalid platform transfer URL format');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      user.platformTransferUrl = transferUrl;
      await user.save();
      return user;
    } catch (error) {
      console.error('❌ Failed to update transfer URL:', error.message);
      throw new Error('Failed to update transfer URL');
    }
  }


  async findByVerificationToken(token: string): Promise<UserDocument | null> {
    return this.userModel.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });
  }

  async setEmailAndSendVerification(
    userId: string,
    newEmail: string,
  ): Promise<{ message: string }> {
    const token = randomUUID();
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        email: newEmail,
        emailVerified: false,
        emailVerificationToken: token,
        emailVerificationExpires: expires,
      },
      { new: true },
    );

    if (!user) throw new NotFoundException('User not found');

    await this.mailService.sendVerificationEmail(newEmail, token);

    return { message: 'Verification email sent' };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    if (!userId) throw new BadRequestException('Missing user ID');

    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (!user.password) throw new ForbiddenException('No password set');

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new ForbiddenException('Current password is incorrect');
    }

    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*]{6,}$/;
    if (!passwordRegex.test(dto.newPassword)) {
      throw new BadRequestException(
        'Password must be at least 6 characters long and contain at least one letter and one number',
      );
    }

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    user.password = hashed;
    await user.save();

    return { message: 'Password successfully updated' };
  }

  async requestPasswordReset(email: string) {
    const user = await this.findByEmail(email);
    if (!user || !user.email) return;

    const token = randomUUID();
    const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

    user.passwordResetToken = token;
    user.passwordResetExpires = expires;
    await user.save();

    await this.mailService.sendPasswordResetEmail(user.email, token);
  }

  async resetPasswordWithToken(
    token: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userModel.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired token');
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
    if (!passwordRegex.test(newPassword)) {
      throw new BadRequestException(
        'Password does not meet complexity requirements',
      );
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();
  }

  async deleteById(id: string) {
    await this.userModel.findByIdAndDelete(id);
  }

  async mergeAccounts(
    primary: UserDocument,
    secondary: UserDocument,
  ): Promise<UserDocument> {
    if (!primary || !secondary) throw new Error('Both users must be provided');

    // LastUsedCookies: newest timestamp wins
    if (
      secondary.lastUsedCookies &&
      (!primary.lastUsedCookiesUpdatedAt ||
        (secondary.lastUsedCookiesUpdatedAt &&
          secondary.lastUsedCookiesUpdatedAt >
            primary.lastUsedCookiesUpdatedAt))
    ) {
      primary.lastUsedCookies = secondary.lastUsedCookies;
      primary.lastUsedCookiesUpdatedAt = secondary.lastUsedCookiesUpdatedAt;
    }

    // Transfer platform data if not present in primary
    if (!primary.externalId && secondary.externalId)
      primary.externalId = secondary.externalId;
    if (!primary.platformAvatar && secondary.platformAvatar)
      primary.platformAvatar = secondary.platformAvatar;
    if (!primary.platformDisplayName && secondary.platformDisplayName)
      primary.platformDisplayName = secondary.platformDisplayName;
    if (!primary.platformProfileUrl && secondary.platformProfileUrl)
      primary.platformProfileUrl = secondary.platformProfileUrl;
    if (!primary.apiToken && secondary.apiToken) {
      primary.apiToken = secondary.apiToken;
      primary.apiTokenSavedAt = secondary.apiTokenSavedAt;
      primary.apiTokenExpiresAt = secondary.apiTokenExpiresAt;
    }
    if (!primary.platformTransferUrl && secondary.platformTransferUrl) {
      primary.platformTransferUrl = secondary.platformTransferUrl;
    }

    // Delete secondary account
    await secondary.deleteOne();

    // Save primary account
    return await primary.save();
  }

  async setExecutorConfig(userId: string, executor: ExecutorConfig) {
    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      { executorConfig: executor, executorConfigUpdatedAt: new Date() },
      { new: true },
    );
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async getExecutorConfig(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new NotFoundException('User not found');
    return {
      executorConfig: user.executorConfig ?? null,
      executorConfigUpdatedAt: user.executorConfigUpdatedAt ?? null,
    };
  }

}
