import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config'; // ⬅️ Wichtig
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { UsersModule } from '../users/users.module';
// Platform strategy removed
import { MailModule } from 'src/mail/mail.module';
import { SubscriptionsModule } from 'src/subscriptions/subscription.module';
import { DiscordAuthController } from './discord/discord-auth.controller';
import { DiscordAuthCallbackController } from './discord/discord-auth.callback.controller';

@Module({
  imports: [
    UsersModule,
    ConfigModule, // ⬅️ Wichtig für registerAsync
    MailModule,
    SubscriptionsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || '',
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [
    AuthController,
    DiscordAuthController,
    DiscordAuthCallbackController,
  ],
  providers: [AuthService, JwtStrategy, RefreshTokenStrategy], // Platform strategy removed
})
export class AuthModule {}
