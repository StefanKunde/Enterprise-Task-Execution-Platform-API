// execution-history/execution-history.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ExecutionHistory,
  ExecutionHistorySchema,
} from './entities/execution-history.schema';
import { ExecutionHistoryService } from './execution-history.service';
import { ExecutionHistoryController } from './execution-history.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExecutionHistory.name, schema: ExecutionHistorySchema },
    ]),
  ],
  providers: [ExecutionHistoryService],
  controllers: [ExecutionHistoryController],
  exports: [ExecutionHistoryService],
})
export class ExecutionHistoryModule {}
