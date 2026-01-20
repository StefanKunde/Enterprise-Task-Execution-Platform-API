import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MaintenanceService } from '../maintenance.service';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { maintenance, message } = await this.maintenanceService.getMaintenanceStatus();

    if (maintenance) {
      throw new ServiceUnavailableException(
        message || 'Service is currently under maintenance. Please try again later.',
      );
    }

    return true;
  }
}
