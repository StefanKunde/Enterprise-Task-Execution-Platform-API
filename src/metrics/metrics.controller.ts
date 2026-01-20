import { Controller, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { UserDataDto } from './dto/user-snapshot.dto';
import { BalanceUpdateDto } from './dto/balance-update.dto';
import { ExecutionInitialDto } from './dto/execution-initiated.dto';
import { ExecutionFinalDto } from './dto/execution-finalized.dto';
import { ExecutionHistoryDto } from './dto/execution-history.dto';
import { ExecutorAuthGuard } from './guards/executor-auth.guard';

@Controller('metrics')
@UseGuards(ExecutorAuthGuard)
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(private readonly metricsService: MetricsService) {}

  @Post('user-data')
  async receiveUserData(@Body() dto: UserDataDto) {
    this.logger.log(`Received user data for sessionId: ${dto.sessionId}`);
    await this.metricsService.handleUserData(dto);
    return { success: true };
  }

  @Post('balance')
  async receiveBalanceUpdate(@Body() dto: BalanceUpdateDto) {
    this.logger.log(`Received balance update for sessionId: ${dto.sessionId}`);
    await this.metricsService.handleBalanceUpdate(dto);
    return { success: true };
  }

  @Post('execution-initial')
  async receiveExecutionInitial(@Body() dto: ExecutionInitialDto) {
    this.logger.log(
      `Received execution initial for executionId: ${dto.executionId}, sessionId: ${dto.sessionId}`,
    );
    await this.metricsService.handleExecutionInitial(dto);
    return { success: true };
  }

  @Post('execution-final')
  async receiveExecutionFinal(@Body() dto: ExecutionFinalDto) {
    this.logger.log(
      `Received execution final for executionId: ${dto.executionId}, status: ${dto.status}, sessionId: ${dto.sessionId}`,
    );
    await this.metricsService.handleExecutionFinal(dto);
    return { success: true };
  }

  @Post('execution-history')
  async receiveExecutionHistory(@Body() dto: ExecutionHistoryDto) {
    this.logger.log(
      `Received execution history for sessionId: ${dto.sessionId}, ${dto.executions.length} executions`,
    );
    await this.metricsService.handleExecutionHistory(dto);
    return { success: true };
  }
}
