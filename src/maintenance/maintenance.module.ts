import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { Maintenance, MaintenanceSchema } from './entities/maintenance.entity';
import { MaintenanceGuard } from './guards/maintenance.guard';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Maintenance.name, schema: MaintenanceSchema },
    ]),
    JwtModule,
  ],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaintenanceGuard],
  exports: [MaintenanceService, MaintenanceGuard],
})
export class MaintenanceModule {}
