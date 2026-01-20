import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Execution,
  ExecutionDocument,
} from '../metrics/entities/execution.schema';
import { MetricsService } from '../metrics/metrics.service';
import { UpdateExecutionDto } from './dto/update-execution.dto';
import { MarkSoldDto } from './dto/mark-finalized.dto';
import { ManualPurchaseDto } from '../metrics/dto/manual-entry.dto';

@Injectable()
export class ExecutionManagementService {
  constructor(
    @InjectModel(Execution.name)
    private executionModel: Model<ExecutionDocument>,
    private metricsService: MetricsService,
  ) {}

  async updateExecution(userId: string, executionId: string, dto: UpdateExecutionDto) {
    const execution = await this.executionModel.findOne({
      userId: new Types.ObjectId(userId),
      executionId,
    });

    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    const updateData: any = {
      isManuallyAdjusted: true,
    };

    if (dto.manualOutboundValue !== undefined) {
      updateData.manualOutboundValue = dto.manualOutboundValue;

      // Recalculate profit if matched to a purchase
      if (execution.matchedToInboundId) {
        const purchaseExecution = await this.executionModel.findOne({
          executionId: execution.matchedToInboundId,
        });
        if (purchaseExecution) {
          updateData.realizedValue = dto.manualOutboundValue - purchaseExecution.totalAmount;
        }
      }
    }

    if (dto.manualOutboundDate) {
      updateData.manualOutboundDate = new Date(dto.manualOutboundDate);
    }

    if (dto.userNotes !== undefined) {
      updateData.userNotes = dto.userNotes;
    }

    await this.executionModel.updateOne({ _id: execution._id }, { $set: updateData });

    return {
      success: true,
      message: 'Execution updated successfully',
    };
  }

  async markAsSold(userId: string, executionId: string, dto: MarkSoldDto) {
    const purchaseExecution = await this.executionModel.findOne({
      userId: new Types.ObjectId(userId),
      executionId,
    });

    if (!purchaseExecution) {
      throw new NotFoundException('Execution not found');
    }

    // Check if already matched to a sale
    if (purchaseExecution.matchedToOutboundId) {
      return {
        success: false,
        message: 'This purchase is already matched to a sale. Unmatch it first.',
      };
    }

    // Update the purchase execution with manual sale info
    const profit = dto.sellPrice - purchaseExecution.totalAmount;
    const notes = dto.notes
      ? `${dto.platform ? `[${dto.platform}] ` : ''}${dto.notes}`
      : dto.platform
        ? `Sold on ${dto.platform}`
        : 'Manually marked as sold';

    await this.executionModel.updateOne(
      { _id: purchaseExecution._id },
      {
        $set: {
          isManuallyAdjusted: true,
          manualOutboundValue: dto.sellPrice,
          manualOutboundDate: new Date(dto.sellDate),
          realizedValue: profit,
          userNotes: notes,
          matchedToOutboundId: 'MANUAL_SALE', // Special marker for manual sales
        },
      },
    );

    return {
      success: true,
      message: 'Execution marked as sold',
      data: {
        profit,
        sellPrice: dto.sellPrice,
      },
    };
  }

  async matchExecutions(
    userId: string,
    sellExecutionId: string,
    purchaseExecutionId: string,
  ) {
    await this.metricsService.manualMatchExecutions(
      sellExecutionId,
      purchaseExecutionId,
      new Types.ObjectId(userId),
    );

    return {
      success: true,
      message: 'Executions matched successfully',
    };
  }

  async unmatchExecution(userId: string, executionId: string) {
    await this.metricsService.unmatchExecution(
      executionId,
      new Types.ObjectId(userId),
    );

    return {
      success: true,
      message: 'Execution unmatched successfully',
    };
  }

  async markManualPurchase(
    userId: string,
    executionId: string,
    dto: ManualPurchaseDto,
  ) {
    await this.metricsService.markAsManualPurchase(
      executionId,
      new Types.ObjectId(userId),
      dto.purchaseSource,
      dto.purchasePrice,
      dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
      dto.notes,
    );

    return {
      success: true,
      message: `Execution marked as ${dto.purchaseSource === 'system' ? 'system purchase' : 'manual purchase'}`,
    };
  }

  async removeManualPurchase(userId: string, executionId: string) {
    await this.metricsService.removeManualPurchase(
      executionId,
      new Types.ObjectId(userId),
    );

    return {
      success: true,
      message: 'Manual purchase marking removed',
    };
  }
}
