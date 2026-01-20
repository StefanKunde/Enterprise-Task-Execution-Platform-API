import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CurrentUserData } from 'src/auth/types/current-user.interface';
import { ExecutionHistoryService } from './execution-history.service';

@Controller('execution-history')
export class ExecutionHistoryController {
  constructor(private readonly executionHistoryService: ExecutionHistoryService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyHistory(
    @CurrentUser() user: CurrentUserData,
    @Query('limit') limit = '20',
    @Query('page') page = '1',
    @Query('status') status?: string,
    @Query('transactionType') transactionType?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sortBy') sortBy = 'updatedAtTimestamp',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const parsedLimit = Math.min(Number(limit) || 20, 100);
    const parsedPage = Math.max(Number(page) || 1, 1);

    const { items, total } = await this.executionHistoryService.findPaginatedByUser(
      user.id,
      {
        status,
        transactionType,
        minAmount: minPrice ? parseFloat(minPrice) : undefined,
        maxAmount: maxPrice ? parseFloat(maxPrice) : undefined,
        from,
        to,
        search,
        limit: parsedLimit,
        page: parsedPage,
        sortBy,
        sortOrder,
      },
    );

    return {
      page: parsedPage,
      limit: parsedLimit,
      total,
      pages: Math.ceil(total / parsedLimit),
      items,
    };
  }
}
