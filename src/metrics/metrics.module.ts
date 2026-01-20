import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { User, UserSchema } from '../users/entities/user.schema';
import {
  BalanceUpdate,
  BalanceUpdateSchema,
} from './entities/balance-update.schema';
import { Execution, ExecutionSchema } from './entities/execution.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: BalanceUpdate.name, schema: BalanceUpdateSchema },
      { name: Execution.name, schema: ExecutionSchema },
    ]),
  ],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
