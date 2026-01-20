import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ExecutionHistory,
  ExecutionHistoryDocument,
} from './entities/execution-history.schema';

@Injectable()
export class ExecutionHistoryService {
  constructor(
    @InjectModel(ExecutionHistory.name)
    private readonly executionHistoryModel: Model<ExecutionHistoryDocument>,
  ) {}

  async upsertExecution(userId: string, data: Partial<ExecutionHistory>) {
    return this.executionHistoryModel.findOneAndUpdate(
      { executionId: data.executionId },
      {
        $set: {
          userId,
          itemName: data.itemName,
          iconUrl: data.iconUrl,
          transactionType: data.transactionType,
          amount: data.amount,
          marginPercent: data.marginPercent,
          status: data.status,
          completed: data.completed,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        },
        $setOnInsert: {
          acquiredBySystem: false,
        },
      },
      {
        upsert: true,
        new: true,
      },
    );
  }

  async confirmExecutionCompletion(userId: string, executionId: string) {
    return this.executionHistoryModel.findOneAndUpdate(
      { executionId },
      {
        $set: {
          userId,
          acquiredBySystem: true,
        },
        $setOnInsert: {
          itemName: '',
          iconUrl: '',
          transactionType: '',
          amount: 0,
          marginPercent: 0,
          status: '',
          completed: false,
          createdAt: '',
          updatedAt: '',
        },
      },
      {
        upsert: true,
        new: true,
      },
    );
  }

  async findAll(): Promise<ExecutionHistory[]> {
    return this.executionHistoryModel.find().sort({ updatedAt: -1 }).exec();
  }

  async findByUserId(userId: string): Promise<ExecutionHistory[]> {
    return this.executionHistoryModel
      .find({ userId })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async findPaginatedByUser(
    userId: string,
    options: {
      status?: string;
      transactionType?: string;
      minAmount?: number;
      maxAmount?: number;
      from?: string;
      to?: string;
      search?: string;
      limit?: number;
      page?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<{ total: number; items: ExecutionHistory[] }> {
    const {
      status,
      transactionType,
      minAmount,
      maxAmount,
      from,
      to,
      search,
      limit = 20,
      page = 1,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = options;

    const query: any = { userId };

    if (status) query.status = status;
    if (transactionType) query.transactionType = transactionType;
    if (minAmount !== undefined)
      query.amount = { ...query.amount, $gte: minAmount };
    if (maxAmount !== undefined)
      query.amount = { ...query.amount, $lte: maxAmount };
    if (from)
      query.updatedAt = {
        ...query.updatedAt,
        $gte: new Date(from),
      };
    if (to)
      query.updatedAt = {
        ...query.updatedAt,
        $lte: new Date(to),
      };
    if (search) {
      query.itemName = { $regex: new RegExp(search, 'i') };
    }

    const sortField = sortBy;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const total = await this.executionHistoryModel.countDocuments(query);
    const items = await this.executionHistoryModel
      .find(query)
      .sort({ [sortField]: sortDirection })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return { total, items };
  }
}
