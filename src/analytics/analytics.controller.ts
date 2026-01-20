import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../auth/types/current-user.interface';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('executions')
  async getExecutions(
    @CurrentUser() user: CurrentUserData,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('isSystemProcessed') isSystemProcessed?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.analyticsService.getExecutions(user.id, {
      limit: Math.min(parseInt(limit || '50'), 200),
      offset: parseInt(offset || '0'),
      status,
      isSystemProcessed:
        isSystemProcessed === 'true'
          ? true
          : isSystemProcessed === 'false'
            ? false
            : undefined,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
      startDate,
      endDate,
    });
  }

  @Get('balance')
  async getBalanceHistory(
    @CurrentUser() user: CurrentUserData,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('reason') reason?: string,
  ) {
    return await this.analyticsService.getBalanceHistory(user.id, {
      limit: Math.min(parseInt(limit || '100'), 500),
      offset: parseInt(offset || '0'),
      startDate,
      endDate,
      reason,
    });
  }

  @Get('statistics')
  async getStatistics(
    @CurrentUser() user: CurrentUserData,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.analyticsService.getStatistics(user.id, {
      startDate,
      endDate,
    });
  }

  @Get('executions/:executionId')
  async getExecutionDetails(
    @CurrentUser() user: CurrentUserData,
    @Param('executionId') executionId: string,
  ) {
    return await this.analyticsService.getExecutionDetails(user.id, executionId);
  }

  @Get('chart-data')
  async getChartData(
    @CurrentUser() user: CurrentUserData,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('interval') interval?: string,
  ) {
    return await this.analyticsService.getChartData(user.id, {
      startDate,
      endDate,
      interval,
    });
  }
}
