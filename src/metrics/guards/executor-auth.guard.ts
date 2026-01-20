import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ExecutorAuthGuard implements CanActivate {
  private readonly logger = new Logger(ExecutorAuthGuard.name);
  private readonly executorApiToken: string;

  constructor(private configService: ConfigService) {
    this.executorApiToken = this.configService.get<string>('EXECUTOR_API_TOKEN') || '';

    if (!this.executorApiToken) {
      this.logger.error(
        '⚠️  EXECUTOR_API_TOKEN not configured! Executor endpoints are NOT PROTECTED!',
      );
    } else {
      this.logger.log('✅ Executor API authentication enabled');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      this.logger.warn(
        `Executor auth failed: Missing Authorization header from IP ${request.ip}`,
      );
      throw new UnauthorizedException('Missing Authorization header');
    }

    // Expected format: "Bearer <token>"
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer') {
      this.logger.warn(
        `Executor auth failed: Invalid auth scheme "${scheme}" from IP ${request.ip}`,
      );
      throw new UnauthorizedException(
        'Invalid authorization scheme. Expected "Bearer <token>"',
      );
    }

    if (!token || token !== this.executorApiToken) {
      this.logger.warn(
        `Executor auth failed: Invalid token from IP ${request.ip}`,
      );
      throw new UnauthorizedException('Invalid executor API token');
    }

    // Successfully authenticated
    return true;
  }
}
