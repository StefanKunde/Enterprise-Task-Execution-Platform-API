import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ExecutorSession,
  ExecutorSessionSchema,
} from './entities/executor-session.schema';
import { ExecutorController } from './executor.controller';
import { ExecutorService } from './executor.service';
import { UsersModule } from '../users/users.module';
import { MaintenanceModule } from 'src/maintenance/maintenance.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExecutorSession.name, schema: ExecutorSessionSchema },
    ]),
    UsersModule,
    MaintenanceModule,
  ],
  controllers: [ExecutorController],
  providers: [ExecutorService],
  exports: [ExecutorService],
})
export class ExecutorModule {}
