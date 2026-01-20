// auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
  Get,
  UnauthorizedException,
  ConflictException,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Response, Request } from 'express';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CurrentUserData } from './types/current-user.interface';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from 'src/users/users.service';
import { randomUUID } from 'crypto';
import { MailService } from 'src/mail/mail.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SubscriptionsService } from 'src/subscriptions/subscription.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
    private readonly mailService: MailService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    const { access_token, refresh_token } = await this.authService.login(user);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: false, // <- @TODO MUSS TRUE SEIN SOBALD SSL AKTIV
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { access_token };
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(
      dto.email,
      dto.password,
      dto.username,
    );
    return user;
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  async refresh(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldRefresh = (req.cookies as Record<string, string>)['refresh_token'];
    const {
      access_token,
      refresh_token,
    }: { access_token: string; refresh_token: string } =
      await this.authService.refreshTokens(user.id, oldRefresh);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: false, // <- @TODO MUSS TRUE SEIN SOBALD SSL AKTIV
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { access_token };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    const refreshToken = req.cookies?.['refresh_token'];

    let userId: string | null = null;

    if (accessToken) {
      try {
        const payload = this.jwtService.verify(accessToken, {
          secret: this.configService.get('JWT_SECRET'),
        });
        userId = payload.sub;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // Access token invalid/expired
      }
    }

    if (!userId && refreshToken) {
      try {
        const payload = this.jwtService.verify(refreshToken, {
          secret: this.configService.get('JWT_REFRESH_SECRET'),
        });
        userId = payload.sub;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // Refresh token invalid
      }
    }

    if (userId) {
      await this.authService.logout(userId); // removes hashed refreshToken from DB
    }

    res.clearCookie('refresh_token');
    return { message: 'Logout erfolgreich' };
  }

  // Platform OAuth login endpoints removed

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string, @Res() res: Response) {
    const success = await this.authService.verifyAndActivateEmail(token);

    return res.redirect(
      success
        ? `${this.configService.get('FRONTEND_URL')}/auth/email-verified`
        : `${this.configService.get('FRONTEND_URL')}/auth/invalid-verification`,
    );
  }

  @Post('/request-verification')
  async requestVerification(@Body('email') email: string) {
    const user = await this.userService.findByEmail(email);

    if (!user || user.emailVerified) {
      // For security: always return success to prevent enumeration
      return {
        message: 'If your email is not yet verified, a new link was sent.',
      };
    }

    const token = randomUUID();
    const expires = new Date(Date.now() + 1000 * 60 * 60);

    user.emailVerificationToken = token;
    user.emailVerificationExpires = expires;
    await user.save();

    await this.mailService.sendVerificationEmail(email, token);

    return {
      message: 'If your email is not yet verified, a new link was sent.',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('/change-password')
  async changePassword(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(user.id, dto);
  }

  @Post('request-password-reset')
  async requestPasswordReset(@Body('email') email: string) {
    await this.userService.requestPasswordReset(email);
    return {
      message: 'If the email exists, a reset link has been sent.',
    };
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    await this.userService.resetPasswordWithToken(body.token, body.newPassword);
    return { message: 'Password has been reset successfully.' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('/merge-account/email')
  async mergeWithEmailAccount(
    @CurrentUser() currentUser: CurrentUserData,
    @Body() body: { email: string; password: string },
  ) {
    const { email, password } = body;

    const platformUser = await this.userService.findById(currentUser.id);
    if (!platformUser || platformUser.email) {
      throw new BadRequestException('This user already has an email.');
    }

    const emailUser = await this.authService.validateUser(email, password);
    if (!emailUser) throw new UnauthorizedException();

    if (emailUser.platformId && emailUser.platformId !== platformUser.platformId) {
      throw new ConflictException(
        'This email account is already linked to a different platform account.',
      );
    }

    // Merge platform info and additional data (including cookies, proxies, etc.)
    const mergedUser = await this.userService.mergeAccounts(
      emailUser,
      platformUser,
    );

    // Transfer subscriptions from platform-only user
    const subscriptionsToTransfer =
      await this.subscriptionsService.getUserSubscriptions(
        platformUser._id.toString(),
      );
    for (const sub of subscriptionsToTransfer) {
      sub.userId = mergedUser._id;
      await sub.save();
    }

    // Delete platform-only user
    await this.userService.deleteById(platformUser._id.toString());

    // Login with merged account
    return this.authService.login(mergedUser);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/merge-account/platform')
  async mergeWithPlatformAccount(
    @CurrentUser() currentUser: CurrentUserData,
    @Body('platformId') platformId: string,
  ) {
    const emailUser = await this.userService.findById(currentUser.id);
    if (!emailUser || emailUser.platformId) {
      throw new BadRequestException(
        'This account already has a platform account linked.',
      );
    }

    const platformUser = await this.userService.findByPlatformId(platformId);
    if (!platformUser) throw new NotFoundException('Platform account not found.');

    if (platformUser.email) {
      throw new ConflictException(
        'This platform account is already linked to another email.',
      );
    }

    const mergedUser = await this.userService.mergeAccounts(
      emailUser,
      platformUser,
    );

    // Transfer subscriptions from platform user
    const subscriptionsToTransfer =
      await this.subscriptionsService.getUserSubscriptions(
        platformUser._id.toString(),
      );
    for (const sub of subscriptionsToTransfer) {
      sub.userId = mergedUser._id;
      await sub.save();
    }

    // Delete platform account
    await this.userService.deleteById(platformUser._id.toString());

    return this.authService.login(mergedUser);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/start-merge-platform')
  startMergePlatform(
    @CurrentUser() currentUser: CurrentUserData,
    @Res({ passthrough: true }) res: Response,
  ) {
    const mergeToken = this.jwtService.sign(
      { sub: currentUser.id },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: '5m',
      },
    );

    res.cookie('merge_token', mergeToken, {
      httpOnly: true,
      secure: false, // in Production: true
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
    });

    return {
      url: `${this.configService.get('API_BASE_URL')}/auth/platform`,
    };
  }
}
