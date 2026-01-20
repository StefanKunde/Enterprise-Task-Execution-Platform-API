// src/auth/discord/discord-auth.controller.ts
import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CurrentUserData } from '../types/current-user.interface';

@Controller('auth/discord')
export class DiscordAuthController {
  constructor(
    private cfg: ConfigService,
    private jwt: JwtService,
  ) {}

  // gibt nur die URL zurück
  @UseGuards(JwtAuthGuard)
  @Get('login-url')
  getLoginUrl(@CurrentUser() user: CurrentUserData) {
    const state = this.jwt.sign({ uid: user.id }, { expiresIn: '10m' });

    const params = new URLSearchParams({
      client_id: this.cfg.getOrThrow('DISCORD_CLIENT_ID'),
      redirect_uri: this.cfg.getOrThrow('DISCORD_REDIRECT_URI'),
      response_type: 'code',
      scope: 'identify guilds.join', // oder nur 'identify'
      state,
      prompt: 'consent',
    });

    const url = `https://discord.com/oauth2/authorize?${params.toString()}`;
    return { url };
  }

  // Optional: Falls du den alten Redirect behalten willst
  // @UseGuards(JwtAuthGuard)
  // @Get('login')
  // login(@CurrentUser() user: CurrentUserData, @Res() res: Response) {
  //   const state = this.jwt.sign({ uid: user.id }, { expiresIn: '10m' });
  //   const params = new URLSearchParams({ ... });
  //   res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  // }
}
