import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Execution,
  ExecutionDocument,
} from '../metrics/entities/execution.schema';
import {
  BalanceUpdate,
  BalanceUpdateDocument,
} from '../metrics/entities/balance-update.schema';
import { User, UserDocument } from '../users/entities/user.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Execution.name)
    private executionModel: Model<ExecutionDocument>,
    @InjectModel(BalanceUpdate.name)
    private balanceUpdateModel: Model<BalanceUpdateDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async getExecutions(userId: string, options: any) {
    // Build query - convert string userId to ObjectId
    const query: any = { userId: new Types.ObjectId(userId) };

    // IMPORTANT: Only show completed executions (exclude JOINED/pending)
    // Unless user specifically requests a status
    if (options.status) {
      query.status = options.status;
    } else {
      query.status = { $in: ['COMPLETED_PROTECTED', 'CANCELLED'] };
    }

    if (typeof options.isSystemProcessed === 'boolean') {
      query.isSystemProcessed = options.isSystemProcessed;
    }

    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) {
        query.createdAt.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        query.createdAt.$lte = new Date(options.endDate);
      }
    }

    // Count total
    const total = await this.executionModel.countDocuments(query);

    // Fetch executions
    const executions = await this.executionModel
      .find(query)
      .sort({ [options.sortBy]: options.sortOrder === 'asc' ? 1 : -1 })
      .skip(options.offset)
      .limit(options.limit)
      .lean();

    // Return executions with their transactionType field from database
    const executionsWithTransactionType = executions.map((execution) => ({
      ...execution,
      // Use transactionType from database if present, fallback to isSystemProcessed for old records
      transactionType: execution.transactionType || (execution.isSystemProcessed ? 'INBOUND' : 'OUTBOUND'),
    }));

    return {
      success: true,
      data: {
        executions: executionsWithTransactionType,
        total,
        limit: options.limit,
        offset: options.offset,
      },
    };
  }

  async getBalanceHistory(userId: string, options: any) {
    const query: any = { userId: new Types.ObjectId(userId) };

    if (options.reason) {
      query.updateReason = options.reason;
    }

    if (options.startDate || options.endDate) {
      query.updatedAt = {};
      if (options.startDate) {
        query.updatedAt.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        query.updatedAt.$lte = new Date(options.endDate);
      }
    }

    const total = await this.balanceUpdateModel.countDocuments(query);

    const balanceUpdates = await this.balanceUpdateModel
      .find(query)
      .sort({ updatedAt: -1 })
      .skip(options.offset)
      .limit(options.limit)
      .lean();

    return {
      success: true,
      data: {
        balanceUpdates,
        total,
        limit: options.limit,
        offset: options.offset,
      },
    };
  }

  async getStatistics(userId: string, options: any) {
    const query: any = { userId: new Types.ObjectId(userId) };

    // Only include completed executions in statistics
    query.status = { $in: ['COMPLETED_PROTECTED', 'CANCELLED'] };

    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) {
        query.createdAt.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        query.createdAt.$lte = new Date(options.endDate);
      }
    }

    // Aggregate execution statistics
    const executions = await this.executionModel.find(query).lean();

    const totalExecutions = executions.length;
    const completedExecutions = executions.filter(
      (t) => t.status === 'COMPLETED_PROTECTED',
    ).length;
    const cancelledExecutions = executions.filter((t) => t.status === 'CANCELLED')
      .length;
    const pendingExecutions = executions.filter((t) => t.status === 'JOINED').length;

    const successRate =
      totalExecutions > 0 ? (completedExecutions / totalExecutions) * 100 : 0;

    const totalValueExecuted = executions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalValueCompleted = executions
      .filter((t) => t.status === 'COMPLETED_PROTECTED')
      .reduce((sum, t) => sum + t.totalAmount, 0);
    const totalValueCancelled = executions
      .filter((t) => t.status === 'CANCELLED')
      .reduce((sum, t) => sum + t.totalAmount, 0);
    const averageExecutionValue =
      totalExecutions > 0 ? totalValueExecuted / totalExecutions : 0;

    // Get balance data
    const balanceQuery: any = { userId: new Types.ObjectId(userId) };
    if (options.startDate || options.endDate) {
      balanceQuery.updatedAt = {};
      if (options.startDate) {
        balanceQuery.updatedAt.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        balanceQuery.updatedAt.$lte = new Date(options.endDate);
      }
    }

    const balanceUpdates = await this.balanceUpdateModel
      .find(balanceQuery)
      .sort({ updatedAt: 1 })
      .lean();

    const currentBalance =
      balanceUpdates.length > 0
        ? balanceUpdates[balanceUpdates.length - 1].balance
        : null;
    const initialBalance = balanceUpdates.length > 0 ? balanceUpdates[0].balance : null;
    const estimatedProfit =
      currentBalance !== null && initialBalance !== null
        ? currentBalance - initialBalance
        : 0;

    // Top items
    const itemCounts = new Map<
      string,
      { count: number; totalValue: number }
    >();
    executions.forEach((execution) => {
      execution.items.forEach((item) => {
        const existing = itemCounts.get(item.itemName) || {
          count: 0,
          totalValue: 0,
        };
        itemCounts.set(item.itemName, {
          count: existing.count + 1,
          totalValue: existing.totalValue + item.value,
        });
      });
    });

    const topItems = Array.from(itemCounts.entries())
      .map(([itemName, data]) => ({
        itemName,
        count: data.count,
        totalValue: data.totalValue,
        averageValue: data.totalValue / data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Cancel reasons
    const cancelReasonCounts = new Map<string, number>();
    executions
      .filter((t) => t.cancelReason)
      .forEach((t) => {
        const count = cancelReasonCounts.get(t.cancelReason!) || 0;
        cancelReasonCounts.set(t.cancelReason!, count + 1);
      });

    const cancelReasons = Array.from(cancelReasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    // Date range
    const sortedExecutions = [...executions].sort(
      (a, b) =>
        new Date(a.initiatedAt).getTime() - new Date(b.initiatedAt).getTime(),
    );
    const firstExecution = sortedExecutions[0]?.initiatedAt || null;
    const lastExecution = sortedExecutions[sortedExecutions.length - 1]?.initiatedAt || null;

    const systemProcessedExecutions = executions.filter((t) => t.isSystemProcessed).length;
    const historicalExecutions = executions.filter((t) => t.isHistorical).length;

    return {
      success: true,
      data: {
        totalExecutions,
        completedExecutions,
        cancelledExecutions,
        pendingExecutions,
        successRate: Math.round(successRate * 100) / 100,
        totalValueExecuted,
        totalValueCompleted,
        totalValueCancelled,
        averageExecutionValue,
        estimatedProfit,
        currentBalance,
        initialBalance,
        systemProcessedExecutions,
        historicalExecutions,
        topItems,
        cancelReasons,
        dateRange: {
          firstExecution,
          lastExecution,
        },
      },
    };
  }

  async getExecutionDetails(userId: string, executionId: string) {
    const execution = await this.executionModel
      .findOne({ userId: new Types.ObjectId(userId), executionId })
      .lean();

    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    const duration =
      execution.finalizedAt && execution.initiatedAt
        ? new Date(execution.finalizedAt).getTime() -
          new Date(execution.initiatedAt).getTime()
        : null;

    return {
      success: true,
      data: {
        ...execution,
        transactionType: execution.transactionType || (execution.isSystemProcessed ? 'INBOUND' : 'OUTBOUND'),
        duration,
        itemCount: execution.items.length,
      },
    };
  }

  async getChartData(userId: string, options: any) {
    const balanceQuery: any = { userId: new Types.ObjectId(userId) };

    if (options.startDate || options.endDate) {
      balanceQuery.updatedAt = {};
      if (options.startDate) {
        balanceQuery.updatedAt.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        balanceQuery.updatedAt.$lte = new Date(options.endDate);
      }
    }

    const balanceHistory = await this.balanceUpdateModel
      .find(balanceQuery)
      .sort({ updatedAt: 1 })
      .select('updatedAt balance updateReason')
      .lean();

    // Get execution events for annotations (only completed executions)
    const executionQuery: any = {
      userId: new Types.ObjectId(userId),
      status: { $in: ['COMPLETED_PROTECTED', 'CANCELLED'] },
    };
    if (options.startDate || options.endDate) {
      executionQuery.finalizedAt = {};
      if (options.startDate) {
        executionQuery.finalizedAt.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        executionQuery.finalizedAt.$lte = new Date(options.endDate);
      }
    }

    const executions = await this.executionModel
      .find(executionQuery)
      .sort({ finalizedAt: 1 })
      .select('executionId status totalAmount finalizedAt initiatedAt')
      .lean();

    const executionEvents = executions
      .filter((t) => t.finalizedAt)
      .map((t) => ({
        timestamp: t.finalizedAt,
        executionId: t.executionId,
        status: t.status,
        totalAmount: t.totalAmount,
        type:
          t.status === 'COMPLETED_PROTECTED'
            ? ('completed' as const)
            : t.status === 'CANCELLED'
              ? ('cancelled' as const)
              : ('joined' as const),
      }));

    return {
      success: true,
      data: {
        balanceHistory: balanceHistory.map((c) => ({
          timestamp: c.updatedAt,
          balance: c.balance,
          reason: c.updateReason,
        })),
        executionEvents,
      },
    };
  }
}
