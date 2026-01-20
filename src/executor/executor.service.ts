// executor.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExecutorSession, ExecutorSessionDocument } from './entities/executor-session.schema';
import { PinoLogger } from 'nestjs-pino';
import { StartExecutorDto } from './dto/start-executor.dto';
import { UsersService } from '../users/users.service';

const AUTO_STOP_MS = 170 /*min*/ * 60 * 1000; // 2h50m

@Injectable()
export class ExecutorService implements OnModuleInit, OnModuleDestroy {
  private autoStopTimers = new Map<string, NodeJS.Timeout>(); // userId -> timeout

  constructor(
    @InjectModel(ExecutorSession.name)
    private readonly executorSessionModel: Model<ExecutorSessionDocument>,
    private readonly logger: PinoLogger,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    // Rehydrate timers for all active sessions with a future scheduledStopAt
    const now = Date.now();
    const sessions = await this.executorSessionModel.find({
      status: { $in: ['waiting', 'running'] },
      scheduledStopAt: { $ne: null },
    });

    for (const s of sessions) {
      const due = (s.scheduledStopAt?.getTime?.() ?? 0) - now;
      if (due <= 0) {
        this.logger.warn(
          { userId: s.userId },
          '[ExecutorService] overdue auto-stop on startup',
        );
        this.stopExecution(s.userId, 'auto_stop_overdue').catch((err) =>
          this.logger.error(err, '[ExecutorService] stopExecution on startup failed'),
        );
      } else {
        this.scheduleAutoStop(s.userId, due);
      }
    }
  }

  onModuleDestroy() {
    for (const t of this.autoStopTimers.values()) clearTimeout(t);
    this.autoStopTimers.clear();
  }

  private scheduleAutoStop(userId: string, delayMs: number) {
    this.clearAutoStop(userId);

    const timeout = setTimeout(
      () => {
        void (async () => {
          try {
            this.logger.info(
              { userId },
              '[ExecutorService] auto-stop firing (2h50m reached)',
            );
            await this.stopExecution(userId, 'auto_stop_2h50');
          } catch (err) {
            this.logger.error(err, '[ExecutorService] auto-stop failed');
          } finally {
            this.clearAutoStop(userId);
          }
        })();
      },
      Math.max(0, delayMs),
    );

    if (typeof (timeout as any).unref === 'function') (timeout as any).unref();
    this.autoStopTimers.set(userId, timeout);
  }

  private clearAutoStop(userId: string) {
    const t = this.autoStopTimers.get(userId);
    if (t) {
      clearTimeout(t);
      this.autoStopTimers.delete(userId);
    }
  }

  private async markLastAction(
    userId: string,
    action: 'start' | 'stop',
    scheduledStopAt: Date | null,
  ) {
    await this.executorSessionModel.updateOne(
      { userId, status: { $in: ['waiting', 'running'] } },
      {
        $set: {
          lastAction: action,
          lastActionAt: new Date(),
          scheduledStopAt,
        },
      },
    );
  }

  async startExecution(userId: string, dto: StartExecutorDto) {
    this.logger.info({ userId, executor: dto.executor }, '[ExecutorService] startExecution');

    const executor =
      dto.executor ?? (await this.usersService.getExecutorConfig(userId)).executorConfig;
    if (!executor) {
      throw new Error('No executor configuration provided and none saved for user');
    }

    await this.replaceExistingSession(userId, 'replaced_by_new_session');

    const now = new Date();
    const scheduledStopAt = new Date(now.getTime() + AUTO_STOP_MS);

    const session = await this.createSession({
      userId,
      status: 'running',
      startedAt: now,
      scheduledStopAt,
      lastAction: 'start',
      lastActionAt: now,
    });

    this.scheduleAutoStop(userId, AUTO_STOP_MS);

    return {
      success: true,
      sessionId: session._id,
      scheduledStopAt
    };
  }

  async stopExecution(userId: string, reason: string = 'user_stop') {
    this.logger.info({ userId, reason }, '[ExecutorService] stopExecution');

    this.clearAutoStop(userId);

    await this.stopSession(userId, reason);
    await this.markLastAction(userId, 'stop', null);

    return { success: true };
  }

  async getExecutionStatus(userId: string) {
    const session = await this.findActiveSessionByUser(userId);
    if (!session) {
      return { active: false, status: null };
    }

    return {
      active: true,
      status: session.status,
      startedAt: session.startedAt,
      scheduledStopAt: session.scheduledStopAt,
      lastAction: session.lastAction,
    };
  }

  async createSession(data: Partial<ExecutorSession>): Promise<ExecutorSession> {
    if (!data.userId) throw new Error('userId is required');
    const active = await this.findActiveSessionByUser(data.userId);
    if (active) await this.stopSession(data.userId, 'replaced_by_new_session');
    const session = new this.executorSessionModel(data);
    return session.save();
  }

  async findActiveSessionByUser(userId: string): Promise<ExecutorSession | null> {
    return this.executorSessionModel.findOne({
      userId,
      status: { $in: ['waiting', 'running'] },
    });
  }

  async stopSession(userId: string, reason: string): Promise<void> {
    await this.executorSessionModel.updateOne(
      { userId, status: { $in: ['waiting', 'running'] } },
      {
        status: 'stopped',
        stoppedReason: reason,
        stoppedAt: new Date(),
      },
    );
  }

  async replaceExistingSession(userId: string, reason: string): Promise<void> {
    const existing = await this.findActiveSessionByUser(userId);
    if (existing) {
      this.logger.warn(`[startExecution] Replacing active session for ${userId}`);
      this.clearAutoStop(userId);
      await this.stopSession(userId, reason);
    }
  }
}
