import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import * as Joi from 'joi';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthModule } from './auth/auth.module';
import { ExecutorModule } from './executor/executor.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SubscriptionsModule } from './subscriptions/subscription.module';
import { MailModule } from './mail/mail.module';
import { ExecutionHistoryModule } from './execution-history/execution-history.module';
import { HttpModule } from '@nestjs/axios';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { MetricsModule } from './metrics/metrics.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    LoggerModule.forRoot(),
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        timeout: 10000,
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        MONGO_URI: Joi.string().required(),
        EXECUTOR_API_TOKEN: Joi.string().required(),
        NODE_ENV: Joi.string()
          .valid('development', 'production')
          .default('development'),
      }),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const uri = config.get<string>('MONGO_URI')!;
        const mongoose = await import('mongoose');
        console.warn('[MONGO] Attempting connection...');

        try {
          await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
          });
          console.warn('[MONGO] ✅ Connected successfully');
        } catch (err) {
          console.error('[MONGO] ❌ Connection failed:', err.message);
          throw err;
        }

        return {
          uri,
        };
      },
    }),

    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    UsersModule,
    AuthModule,
    ExecutorModule,
    SubscriptionsModule,
    MailModule,
    ExecutionHistoryModule,
    OrdersModule,
    PaymentsModule,
    MaintenanceModule,
    MetricsModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService, AllExceptionsFilter],
})
export class AppModule {}
