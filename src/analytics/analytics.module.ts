import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ExecutionManagementController } from './execution-management.controller';
import { ExecutionManagementService } from './execution-management.service';
import { Execution, ExecutionSchema } from '../metrics/entities/execution.schema';
import {
  BalanceUpdate,
  BalanceUpdateSchema,
} from '../metrics/entities/balance-update.schema';
import { User, UserSchema } from '../users/entities/user.schema';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Execution.name, schema: ExecutionSchema },
      { name: BalanceUpdate.name, schema: BalanceUpdateSchema },
      { name: User.name, schema: UserSchema },
    ]),
    MetricsModule,
  ],
  controllers: [AnalyticsController, ExecutionManagementController],
  providers: [AnalyticsService, ExecutionManagementService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
