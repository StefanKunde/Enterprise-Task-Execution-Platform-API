import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CurrentUserData } from 'src/auth/types/current-user.interface';
import { PinoLogger } from 'nestjs-pino';
import { SubscriptionsService } from 'src/subscriptions/subscription.service';
import { SetPlatformWebTokenDto } from './dto/set-platform-token.dto';
import { SetExecutorConfigDto } from './dto/set-executor-config.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly logger: PinoLogger,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: CurrentUserData) {
    const dbUser = await this.usersService.findById(user.id);

    const activePremiumSub = await this.subscriptionsService.getActiveSubscription(
      user.id,
      'PREMIUM',
    );
    const activeAutoAcceptSub =
      await this.subscriptionsService.getActiveSubscription(
        user.id,
        'ENTERPRISE',
      );

    if (!dbUser) {
      throw new Error('User not found');
    }

    // helper to shape a sub for /me
    const toMeSub = (s?: any) => {
      if (!s) return null;
      const now = Date.now();
      const expMs = new Date(s.expiresAt).getTime();
      const remainingMs = Math.max(0, expMs - now);

      return {
        model: s.model,
        costInEuro: s.costInEuro,
        createdAt: s.createdAt,
        startedAt: s.startedAt,
        expiresAt: s.expiresAt,
        remainingDays: Math.max(0, Math.ceil(remainingMs / 86_400_000)),
        remainingSeconds: Math.floor(remainingMs / 1000),
        isTrial: !!s.isTrial,
      };
    };

    return {
      userId: user.id,
      username: dbUser.username,
      email: dbUser.email,
      hasPassword: !!dbUser.password,
      executorConfig: dbUser.executorConfig ?? null,
      executorConfigUpdatedAt: dbUser.executorConfigUpdatedAt ?? null,

      // Platform
      platformId: dbUser.platformId,
      platformAvatar: dbUser.platformAvatar,
      platformDisplayName: dbUser.platformDisplayName,
      platformProfileUrl: dbUser.platformProfileUrl,
      platformWebTokenExpiresAt: dbUser.platformWebTokenExpiresAt,
      platformWebTokenSavedAt: dbUser.platformWebTokenSavedAt,
      platformWebToken: dbUser.platformWebToken,
      transferUrl: dbUser.platformTransferUrl,

      // Discord status for frontend
      discordId: dbUser.discordId ?? null,
      discordUsername: dbUser.discordUsername ?? null,
      discordLinkedAt: dbUser.discordLinkedAt ?? null,
      discordJoinVerifiedAt: dbUser.discordJoinVerifiedAt ?? null,

      // History (unchanged)
      subscriptionHistory: await this.subscriptionsService.getHistoryForUser(
        user.id,
      ),

      // Active subs with NEW fields
      subscriptionPremium: toMeSub(activePremiumSub),
      subscriptionAutoAccept: toMeSub(activeAutoAcceptSub),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateFilterSettings(@CurrentUser() user: CurrentUserData) {
    this.logger.info(`Saving filters for user ${user.id}`);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/email')
  async updateEmail(
    @CurrentUser() user: CurrentUserData,
    @Body('email') newEmail: string,
  ) {
    return await this.usersService.setEmailAndSendVerification(
      user.id,
      newEmail,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('platform-web-token')
  async setPlatformWebToken(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SetPlatformWebTokenDto,
  ) {
    return await this.usersService.setPlatformWebToken(user.id, dto.token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('transfer-url')
  async setTransferUrl(
    @CurrentUser() user: CurrentUserData,
    @Body() body: { transferUrl: string },
  ) {
    const { transferUrl } = body;

    if (!transferUrl) {
      throw new Error('Missing transferUrl');
    }

    await this.usersService.updatePlatformTransferUrl(user.id, transferUrl);

    return { message: 'Transfer URL updated successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/executor-config')
  async getMyExecutorConfig(@CurrentUser() user: CurrentUserData) {
    return await this.usersService.getExecutorConfig(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/executor-config')
  async setMyExecutorConfig(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SetExecutorConfigDto,
  ) {
    const updated = await this.usersService.setExecutorConfig(user.id, dto);
    return {
      success: true,
      executorConfig: updated.executorConfig,
      executorConfigUpdatedAt: updated.executorConfigUpdatedAt,
    };
  }
}
