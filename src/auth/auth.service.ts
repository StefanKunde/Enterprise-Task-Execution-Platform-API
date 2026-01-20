// auth/auth.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { UserDocument } from '../users/entities/user.schema';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { MailService } from 'src/mail/mail.service';
import { addMinutes } from 'date-fns';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  onModuleInit() {
    console.warn('[AuthService] onModuleInit called');
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Unauthorized');
    }
    if (!user.emailVerified) {
      throw new ForbiddenException('Your email address has not been verified');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Unauthorized');
    return user;
  }

  async login(user: UserDocument): Promise<TokenPair> {
    const payload = {
      sub: user._id,
      email: user.email,
      platformId: user.platformId ?? null,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
      secret: this.configService.get<string>('JWT_SECRET') || '',
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
      secret: this.configService.get<string>('JWT_REFRESH_SECRET') || '',
    });

    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(
      user._id.toString(),
      hashedRefresh,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async register(email: string, password: string, username: string) {
    // Email already in use?
    const existingUserByMail = await this.usersService.findByEmail(email);
    if (existingUserByMail) {
      throw new BadRequestException('Email is already in use.');
    }

    // Username already in use?
    const existingUserByUsername =
      await this.usersService.findByUsername(username);

    if (existingUserByUsername) {
      throw new BadRequestException('Username is already taken.');
    }

    // Password policy
    if (password.length < 6) {
      throw new BadRequestException(
        'Password must be at least 6 characters long.',
      );
    }

    const emailVerificationToken = randomUUID();
    const emailVerificationExpires = addMinutes(new Date(), 60);
    const hashed = await bcrypt.hash(password, 10);

    await this.mailService.sendVerificationEmail(email, emailVerificationToken);

    const user = await this.usersService.create({
      email,
      password: hashed,
      username,
      emailVerificationToken,
      emailVerificationExpires,
      lastUsedCookies: '',
      isCurrentlyUsingSystem: false,
      proxy: undefined,
      refreshToken: '',
      isSuperUser: false,
      isMasterUser: false,
      lastKnownBalance: 0,
      filterJson: {
        'item-filter': {
          'cases-filter': {
            'buy-cases': false,
            'max-val': 50,
            'min-val': 5,
          },
          'name-type-condition-filters-not-buy': [
            {
              name: 'Pathfinder',
              type: 'usp',
            },
            {
              name: 'electric hive',
              type: 'awp',
              'conditions-to-not-buy': ['bs', 'ww', 'ft'],
            },
          ],
          buyKnifesWithStattrak: true,
          namesToIgnore: ['Printstream'],
          typesToIgnore: ['knife'],
          stickerSettings: {
            'buy-items-with-stickers': false,
            'max-variance-for-item-with-stickers': 0,
            'max-price-for-item-with-stickers': 0,
            'minimum-total-sticker-value': 0,
            'total-sticker-values-percentage-by-item-value': 0,
          },
        },
        max_variance: 5,
        max_value_threshold: 500,
        min_value_threshold: 5,
      },
    });

    return this.login(user);
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshToken) throw new UnauthorizedException();

    const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValid) throw new UnauthorizedException();

    return this.login(user); // generates new tokens and saves refreshToken
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
  }

  async validateOrCreatePlatformUser(
    platformId: string,
    profile: any,
  ): Promise<UserDocument> {
    const platformDisplayName = profile.displayName || 'PlatformUser';
    const platformAvatar = profile.photos?.[0]?.value || '';
    const platformProfileUrl = `https://platform.example.com/profiles/${platformId}`;

    const existingUser = await this.usersService.findByPlatformId(platformId);

    if (existingUser) {
      // Platform display name may have changed - update it
      let needsUpdate = false;

      if (existingUser.username !== platformDisplayName) {
        existingUser.username = platformDisplayName;
        needsUpdate = true;
      }

      if (existingUser.platformAvatar !== platformAvatar) {
        existingUser.platformAvatar = platformAvatar;
        needsUpdate = true;
      }

      if (existingUser.platformDisplayName !== platformDisplayName) {
        existingUser.platformDisplayName = platformDisplayName;
        needsUpdate = true;
      }

      if (existingUser.platformProfileUrl !== platformProfileUrl) {
        existingUser.platformProfileUrl = platformProfileUrl;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await existingUser.save();
      }

      return existingUser;
    }

    // Create new user with current platform display name
    const user = await this.usersService.create({
      email: null,
      password: null,
      username: platformDisplayName,
      platformId,
      platformAvatar,
      platformDisplayName,
      platformProfileUrl,
      lastUsedCookies: '',
      isCurrentlyUsingSystem: false,
      proxy: undefined,
      refreshToken: '',
      isSuperUser: false,
      isMasterUser: false,
      lastKnownBalance: 0,
      filterJson: {
        'item-filter': {
          'cases-filter': {
            'buy-cases': false,
            'max-val': 50,
            'min-val': 5,
          },
          'name-type-condition-filters-not-buy': [],
          buyKnifesWithStattrak: true,
          namesToIgnore: [],
          typesToIgnore: [],
          stickerSettings: {
            'buy-items-with-stickers': false,
            'max-variance-for-item-with-stickers': 0,
            'max-price-for-item-with-stickers': 0,
            'minimum-total-sticker-value': 0,
            'total-sticker-values-percentage-by-item-value': 0,
          },
        },
        max_variance: 5,
        max_value_threshold: 500,
        min_value_threshold: 5,
      },
    });

    return user;
  }

  async verifyAndActivateEmail(token: string): Promise<boolean> {
    const user = await this.usersService.findByVerificationToken(token);
    if (!user) return false;

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    return true;
  }
}
