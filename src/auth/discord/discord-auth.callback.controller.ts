// src/auth/discord/discord-auth.callback.controller.ts
import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import fetch from 'node-fetch';
import { UsersService } from 'src/users/users.service';

interface DiscordTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string; // e.g. "identify guilds.join"
}

interface DiscordUserMe {
  id: string;
  username: string;
}

@Controller('auth/discord')
export class DiscordAuthCallbackController {
  constructor(
    private cfg: ConfigService,
    private jwt: JwtService,
    private users: UsersService,
  ) {}

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // 0) state verifizieren -> userId extrahieren
      const decoded = this.jwt.verify<{ uid: string }>(state);
      const userId = decoded.uid;

      // 1) code -> access_token
      const tokenResp = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.cfg.getOrThrow('DISCORD_CLIENT_ID'),
          client_secret: this.cfg.getOrThrow('DISCORD_CLIENT_SECRET'),
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.cfg.getOrThrow('DISCORD_REDIRECT_URI'),
        }),
      });

      if (!tokenResp.ok) {
        res.redirect('/pricing?err=discord_oauth_failed');
        return;
      }

      const tokenRes = (await tokenResp.json()) as DiscordTokenResponse;
      if (!tokenRes?.access_token) {
        res.redirect('/pricing?err=discord_oauth_failed');
        return;
      }

      // 2) /users/@me
      const meResp = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenRes.access_token}` },
      });

      if (!meResp.ok) {
        res.redirect('/pricing?err=discord_me_failed');
        return;
      }

      const me = (await meResp.json()) as DiscordUserMe;
      const discordId = me.id;
      const discordUsername = me.username;

      // 3) Optional: Auto-Join (if scope guilds.join is included)
      const guildId = this.cfg.getOrThrow('DISCORD_GUILD_ID');
      const serviceToken = this.cfg.getOrThrow('DISCORD_SERVICE_TOKEN'); // Service token

      let joined = false;
      if (tokenRes.scope.includes('guilds.join')) {
        const joinResp = await fetch(
          `https://discord.com/api/guilds/${guildId}/members/${discordId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: serviceToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ access_token: tokenRes.access_token }),
          },
        );
        joined = [200, 201, 204].includes(joinResp.status);
      }

      // 4) Link user and verify if applicable
      await this.users.update(userId, {
        discordId,
        discordUsername,
        discordLinkedAt: new Date(),
        ...(joined ? { discordJoinVerifiedAt: new Date() } : {}),
      });

      // 5) Redirect back to frontend
      res.redirect(joined ? '/pricing?discord=ok' : '/pricing?discord=linked');
      return;
    } catch {
      // No unused variable for clean eslint
      res.redirect('/pricing?err=discord_callback_failed');
      return;
    }
  }
}
