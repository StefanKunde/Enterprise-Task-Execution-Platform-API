import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      // Check if user is admin
      const adminEmails = this.configService
        .get<string>('ADMIN_EMAILS', '')
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      const adminIds = this.configService
        .get<string>('ADMIN_IDS', '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      const isAdmin =
        adminEmails.includes(payload.email) || adminIds.includes(payload.sub);

      if (!isAdmin) {
        throw new UnauthorizedException('Admin access required');
      }

      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token or not authorized');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
