import {
  Controller,
  Post,
  UseGuards,
  Body,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { SubscriptionsService } from './subscription.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../auth/types/current-user.interface';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('trial')
  @UseGuards(JwtAuthGuard)
  async trial(
    @CurrentUser() user: CurrentUserData,
    @Body('model') model: string,
    @Body('feature') feature: 'PREMIUM' | 'ENTERPRISE',
  ) {
    if (!user?.id) throw new BadRequestException('Invalid user');
    if (!model || !feature) {
      throw new BadRequestException('model and feature are required');
    }
    return this.subscriptionsService.activateTrial(user.id, model, feature);
  }

  @Get('plans')
  getPlans() {
    return this.subscriptionsService.getAvailablePlans();
  }
}
