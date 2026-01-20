import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { SetMaintenanceDto } from './dto/set-maintenance.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller()
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('maintenance/status')
  async getMaintenanceStatus() {
    return this.maintenanceService.getMaintenanceStatus();
  }

  @Post('admin/maintenance')
  @UseGuards(AdminGuard)
  async setMaintenanceMode(@Body() dto: SetMaintenanceDto) {
    return this.maintenanceService.setMaintenanceMode(
      dto.maintenance,
      dto.message || null,
    );
  }
}
