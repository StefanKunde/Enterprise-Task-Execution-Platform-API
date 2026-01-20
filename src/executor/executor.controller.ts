import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { ExecutorService } from './executor.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { MaintenanceGuard } from 'src/maintenance/guards/maintenance.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CurrentUserData } from 'src/auth/types/current-user.interface';
import { StartExecutorDto } from './dto/start-executor.dto';

@Controller('executor')
export class ExecutorController {
  constructor(private readonly executorService: ExecutorService) {}

  @UseGuards(JwtAuthGuard, MaintenanceGuard)
  @Post('start')
  async startExecutor(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: StartExecutorDto,
  ) {
    return await this.executorService.startExecution(user.id, dto);
  }

  @UseGuards(JwtAuthGuard, MaintenanceGuard)
  @Post('stop')
  async stopExecutor(@CurrentUser() user: CurrentUserData) {
    return await this.executorService.stopExecution(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getExecutorStatus(@CurrentUser() user: CurrentUserData) {
    const session = await this.executorService.findActiveSessionByUser(user.id);
    return {
      running: session?.status === 'running',
      scheduledStopAt: session?.scheduledStopAt ?? null,
      lastAction: session?.lastAction ?? null,
      lastActionAt: session?.lastActionAt ?? null,
    };
  }
}
