import {
  Controller,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../auth/types/current-user.interface';
import { ExecutionManagementService } from './execution-management.service';
import { UpdateExecutionDto } from './dto/update-execution.dto';
import { MarkSoldDto } from './dto/mark-finalized.dto';
import { MatchExecutionsDto } from './dto/match-executions.dto';
import { ManualPurchaseDto } from '../metrics/dto/manual-entry.dto';

@Controller('analytics/executions')
@UseGuards(JwtAuthGuard)
export class ExecutionManagementController {
  constructor(
    private readonly executionManagementService: ExecutionManagementService,
  ) {}

  @Patch(':executionId')
  async updateExecution(
    @CurrentUser() user: CurrentUserData,
    @Param('executionId') executionId: string,
    @Body() dto: UpdateExecutionDto,
  ) {
    return await this.executionManagementService.updateExecution(
      user.id,
      executionId,
      dto,
    );
  }

  @Post(':executionId/mark-sold')
  async markAsSold(
    @CurrentUser() user: CurrentUserData,
    @Param('executionId') executionId: string,
    @Body() dto: MarkSoldDto,
  ) {
    return await this.executionManagementService.markAsSold(user.id, executionId, dto);
  }

  @Post(':executionId/match')
  async matchExecutions(
    @CurrentUser() user: CurrentUserData,
    @Param('executionId') sellExecutionId: string,
    @Body() dto: MatchExecutionsDto,
  ) {
    return await this.executionManagementService.matchExecutions(
      user.id,
      sellExecutionId,
      dto.purchaseExecutionId,
    );
  }

  @Delete(':executionId/match')
  async unmatchExecution(
    @CurrentUser() user: CurrentUserData,
    @Param('executionId') executionId: string,
  ) {
    return await this.executionManagementService.unmatchExecution(user.id, executionId);
  }

  @Post(':executionId/mark-manual-purchase')
  async markManualPurchase(
    @CurrentUser() user: CurrentUserData,
    @Param('executionId') executionId: string,
    @Body() dto: ManualPurchaseDto,
  ) {
    return await this.executionManagementService.markManualPurchase(
      user.id,
      executionId,
      dto,
    );
  }

  @Delete(':executionId/manual-purchase')
  async removeManualPurchase(
    @CurrentUser() user: CurrentUserData,
    @Param('executionId') executionId: string,
  ) {
    return await this.executionManagementService.removeManualPurchase(
      user.id,
      executionId,
    );
  }
}
