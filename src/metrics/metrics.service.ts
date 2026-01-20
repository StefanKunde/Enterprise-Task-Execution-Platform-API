import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/entities/user.schema';
import {
  BalanceUpdate,
  BalanceUpdateDocument,
} from './entities/balance-update.schema';
import { Execution, ExecutionDocument } from './entities/execution.schema';
import { UserDataDto } from './dto/user-snapshot.dto';
import { BalanceUpdateDto } from './dto/balance-update.dto';
import { ExecutionInitialDto } from './dto/execution-initiated.dto';
import { ExecutionFinalDto } from './dto/execution-finalized.dto';
import { ExecutionHistoryDto } from './dto/execution-history.dto';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(BalanceUpdate.name)
    private balanceUpdateModel: Model<BalanceUpdateDocument>,
    @InjectModel(Execution.name)
    private executionModel: Model<ExecutionDocument>,
  ) {}

  /**
   * Optimized two-step user lookup:
   * 1. Try to find user by platformUserId (fastest, indexed)
   * 2. Fallback to sessionId in executorConfig
   * 3. Store platformUserId if found via sessionId for future fast lookups
   */
  private async findUserBySessionOrCsgoId(
    sessionId: string,
    platformUserId: string,
  ): Promise<UserDocument> {
    this.logger.debug(
      `Looking up user - sessionId: ${sessionId}, platformUserId: ${platformUserId}`,
    );

    // Step 1: Try platformUserId first (fastest - indexed lookup)
    let user = await this.userModel.findOne({ platformUserId });

    if (user) {
      this.logger.debug(
        `✓ User found by platformUserId: ${platformUserId} -> userId: ${user._id}`,
      );
      return user;
    }

    this.logger.debug(
      `No user found by platformUserId, trying sessionId lookup...`,
    );

    // Step 2: Fallback to sessionId in executorConfig
    user = await this.userModel.findOne({
      'executorConfig.sessionId': sessionId,
    });

    if (!user) {
      // Log all users with executorConfig to help debug
      const usersWithExecutorConfig = await this.userModel
        .find({ executorConfig: { $exists: true } })
        .select('_id username executorConfig.sessionId')
        .limit(5);

      this.logger.error(
        `❌ User not found! SessionId: "${sessionId}", PlatformUserId: "${platformUserId}"`,
      );
      this.logger.error(
        `Found ${usersWithExecutorConfig.length} users with executorConfig (showing first 5):`,
      );
      usersWithExecutorConfig.forEach((u) => {
        this.logger.error(
          `  - User ${u._id} (${u.username}): sessionId="${u.executorConfig?.sessionId}"`,
        );
      });

      throw new Error(
        `User not found for sessionId: ${sessionId} or platformUserId: ${platformUserId}`,
      );
    }

    this.logger.debug(
      `✓ User found by sessionId: ${sessionId} -> userId: ${user._id}, username: ${user.username}`,
    );

    // Step 3: Store platformId for future fast lookups
    if (!user.platformId) {
      await this.userModel.updateOne(
        { _id: user._id },
        { $set: { platformId: platformUserId } },
      );
      this.logger.log(
        `Stored platformUserId ${platformUserId} for user ${user._id}`,
      );
    }

    return user;
  }

  async handleUserData(dto: UserDataDto): Promise<void> {
    try {
      const user = await this.findUserBySessionOrCsgoId(
        dto.sessionId,
        dto.userId,
      );

      // Update user with platform data
      await this.userModel.updateOne(
        { _id: user._id },
        {
          $set: {
            platformUserId: dto.userId,
            platformDisplayName: dto.displayName,
            platformLevel: dto.level,
            platformXp: dto.xp,
            platformFlaggedUser: dto.flaggedUser,
            platformRestrictedUntil: dto.restrictedUntil
              ? new Date(dto.restrictedUntil)
              : null,
            platformBannedUntil: dto.bannedUntil
              ? new Date(dto.bannedUntil)
              : null,
            platformWeeklyLimit: dto.weeklyLimit,
            platformRemainingInstantPayoutAmount:
              dto.remainingInstantPayoutAmount,
            platformLastExchangeRates: dto.exchangeRates,
            platformLastDataUpdate: new Date(dto.collectedAt),
          },
        },
      );

      this.logger.log(
        `Updated user data for platformUserId: ${dto.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling user data: ${error.message}`,
        error.stack,
      );
      // Don't throw - always return success to system
    }
  }

  async handleBalanceUpdate(dto: BalanceUpdateDto): Promise<void> {
    try {
      const user = await this.findUserBySessionOrCsgoId(
        dto.sessionId,
        dto.platformUserId,
      );

      await this.balanceUpdateModel.create({
        userId: user._id,
        platformUserId: user.platformId!,
        balance: dto.balance,
        updateReason: dto.reason,
        updatedAt: new Date(dto.timestamp),
      });

      this.logger.log(
        `Balance update recorded: ${dto.balance} (${dto.reason}) for user ${user._id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling balance update: ${error.message}`,
        error.stack,
      );
      // Don't throw - always return success to system
    }
  }

  async handleExecutionInitial(dto: ExecutionInitialDto): Promise<void> {
    try {
      const user = await this.findUserBySessionOrCsgoId(
        dto.sessionId,
        dto.platformUserId,
      );

      // Check if execution already exists
      const existingExecution = await this.executionModel.findOne({
        executionId: dto.executionId,
      });

      if (existingExecution) {
        this.logger.warn(
          `Execution ${dto.executionId} already exists, skipping initial data`,
        );
        return;
      }

      await this.executionModel.create({
        userId: user._id,
        platformUserId: user.platformId!,
        executionId: dto.executionId,
        status: dto.status,
        isHistorical: false,
        isSystemProcessed: true, // Mark as system-processed execution
        transactionType: dto.transactionType || 'INBOUND',
        initiatedAt: new Date(dto.initiatedAt),
        totalAmount: dto.totalValue,
        marginPercent: dto.marginPercent,
        items: dto.items,
        finalizedAt: null,
      });

      this.logger.log(
        `Execution initial data recorded: ${dto.executionId} for user ${user._id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling execution initial: ${error.message}`,
        error.stack,
      );
      // Don't throw - always return success to system
    }
  }

  async handleExecutionFinal(dto: ExecutionFinalDto): Promise<void> {
    try {
      const user = await this.findUserBySessionOrCsgoId(
        dto.sessionId,
        dto.platformUserId,
      );

      // Find the execution record
      const execution = await this.executionModel.findOne({
        executionId: dto.executionId,
      });

      let savedExecution: ExecutionDocument;

      if (!execution) {
        this.logger.warn(
          `Execution ${dto.executionId} not found, creating new record with final data`,
        );

        // Create new execution if not found
        savedExecution = await this.executionModel.create({
          userId: user._id,
          platformUserId: user.platformId!,
          executionId: dto.executionId,
          status: dto.status,
          isHistorical: false,
          isSystemProcessed: true,
          transactionType: dto.transactionType || 'INBOUND',
          initiatedAt: new Date(dto.updatedAt), // Use updatedAt as initiatedAt fallback
          updatedAt: new Date(dto.updatedAt),
          cancelReason: dto.cancelReason,
          totalAmount: dto.totalValue,
          marginPercent: dto.marginPercent,
          items: dto.items,
          finalizedAt: new Date(),
        });
      } else {
        // Update existing execution
        await this.executionModel.updateOne(
          { executionId: dto.executionId },
          {
            $set: {
              status: dto.status,
              transactionType: dto.transactionType || 'INBOUND',
              updatedAt: new Date(dto.updatedAt),
              cancelReason: dto.cancelReason,
              totalAmount: dto.totalValue,
              marginPercent: dto.marginPercent,
              items: dto.items,
              finalizedAt: new Date(),
            },
          },
        );

        savedExecution = (await this.executionModel.findOne({
          executionId: dto.executionId,
        }))!;
      }

      this.logger.log(
        `Execution final data recorded: ${dto.executionId} (${dto.status}) for user ${user._id}`,
      );

      // Attempt automatic matching if this is a completed SELL execution (transactionType: 'OUTBOUND')
      if (
        dto.status === 'COMPLETED_PROTECTED' &&
        savedExecution.transactionType === 'OUTBOUND'
      ) {
        await this.matchSellToPurchase(savedExecution);
      }
    } catch (error) {
      this.logger.error(
        `Error handling execution final: ${error.message}`,
        error.stack,
      );
      // Don't throw - always return success to system
    }
  }

  async handleExecutionHistory(dto: ExecutionHistoryDto): Promise<void> {
    try {
      const user = await this.findUserBySessionOrCsgoId(
        dto.sessionId,
        dto.platformUserId,
      );

      let processedCount = 0;
      let skippedCount = 0;

      for (const historicalExecution of dto.executions) {
        // Check if execution already exists by executionId
        const existingExecution = await this.executionModel.findOne({
          executionId: historicalExecution.id,
        });

        if (existingExecution) {
          skippedCount++;
          continue;
        }

        // RECONCILIATION: Check if this matches an incomplete system execution
        // Match by: price (2 decimals), and time proximity (within 30 days)
        const historicalInitiatedAt = new Date(historicalExecution.initiatedAt);
        const thirtyDaysAgo = new Date(historicalInitiatedAt);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Round prices to 2 decimals for comparison
        const historicalPrice = parseFloat(historicalExecution.totalValue.toFixed(2));
        const priceMin = parseFloat((historicalPrice - 0.01).toFixed(2));
        const priceMax = parseFloat((historicalPrice + 0.01).toFixed(2));

        const incompleteSystemExecution = await this.executionModel.findOne({
          userId: user._id,
          isSystemProcessed: true,
          status: 'JOINED', // Incomplete (never got final status)
          totalAmount: { $gte: priceMin, $lte: priceMax }, // Match price ±$0.01
          initiatedAt: {
            $gte: thirtyDaysAgo,
            $lte: new Date(historicalInitiatedAt.getTime() + 60000), // Within 1 min
          },
        });

        if (incompleteSystemExecution) {
          // Found matching incomplete execution - UPDATE it instead of creating new
          this.logger.log(
            `Reconciling incomplete system execution ${incompleteSystemExecution.executionId} with history execution ${historicalExecution.id}`,
          );

          await this.executionModel.updateOne(
            { _id: incompleteSystemExecution._id },
            {
              $set: {
                status: historicalExecution.status,
                updatedAt: new Date(historicalExecution.updatedAt),
                // Prefer items (with imageUrl) over executionItems
                items: historicalExecution.items || historicalExecution.executionItems,
                transactionType: historicalExecution.transactionType,
                finalizedAt:
                  historicalExecution.status === 'COMPLETED_PROTECTED' ||
                  historicalExecution.status === 'CANCELLED'
                    ? new Date(historicalExecution.updatedAt)
                    : null,
              },
            },
          );

          processedCount++;
          continue;
        }

        // No match found - create new historical execution
        const savedExecution = await this.executionModel.create({
          userId: user._id,
          platformUserId: user.platformId!,
          executionId: historicalExecution.id,
          status: historicalExecution.status,
          isHistorical: true, // Mark as historical
          isSystemProcessed: false, // Not processed by system
          transactionType: historicalExecution.transactionType,
          initiatedAt: new Date(historicalExecution.initiatedAt),
          updatedAt: new Date(historicalExecution.updatedAt),
          totalAmount: historicalExecution.totalValue,
          marginPercent: historicalExecution.marginPercent,
          // Prefer items (with imageUrl) over executionItems
          items: historicalExecution.items || historicalExecution.executionItems,
          finalizedAt:
            historicalExecution.status === 'COMPLETED_PROTECTED' ||
            historicalExecution.status === 'CANCELLED'
              ? new Date(historicalExecution.updatedAt)
              : null,
        });

        processedCount++;

        // If this is a completed SELL execution (transactionType: 'OUTBOUND'), try to auto-match it
        if (
          historicalExecution.status === 'COMPLETED_PROTECTED' &&
          historicalExecution.transactionType === 'OUTBOUND'
        ) {
          await this.matchSellToPurchase(savedExecution);
        }
      }

      this.logger.log(
        `Execution history processed for user ${user._id}: ${processedCount} new, ${skippedCount} skipped`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling execution history: ${error.message}`,
        error.stack,
      );
      // Don't throw - always return success to system
    }
  }

  /**
   * Helper method to check if a execution can be matched from history
   * This can be used to update incomplete system-processed executions
   */
  async reconcileExecutionFromHistory(executionId: string): Promise<void> {
    try {
      const historicalExecution = await this.executionModel.findOne({
        executionId,
        isHistorical: true,
      });

      if (!historicalExecution) {
        this.logger.debug(
          `No historical execution found for reconciliation: ${executionId}`,
        );
        return;
      }

      const systemExecution = await this.executionModel.findOne({
        executionId,
        isSystemProcessed: true,
      });

      if (systemExecution && !systemExecution.finalizedAt) {
        // Update system execution with data from historical execution
        await this.executionModel.updateOne(
          { _id: systemExecution._id },
          {
            $set: {
              status: historicalExecution.status,
              updatedAt: historicalExecution.updatedAt,
              finalizedAt: historicalExecution.finalizedAt,
            },
          },
        );

        this.logger.log(
          `Reconciled system execution ${executionId} from historical data`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error reconciling execution: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * FIFO Matching Algorithm
   * Automatically matches a SELL execution to the oldest unmatched BUY execution
   * with the same item name and reasonable price range (±50%)
   */
  async matchSellToPurchase(sellExecution: ExecutionDocument): Promise<void> {
    try {
      // Only match if not already matched
      if (sellExecution.matchedToInboundId) {
        this.logger.debug(
          `Sell execution ${sellExecution.executionId} already matched, skipping`,
        );
        return;
      }

      let matchCount = 0;

      // Match each item in the sell execution
      for (const sellItem of sellExecution.items) {
        // Find oldest unmatched BUY of same itemName
        const matchedBuy = await this.executionModel
          .findOne({
            userId: sellExecution.userId,
            isSystemProcessed: true, // Only match system purchases
            matchedToOutboundId: null, // Not yet matched
            'items.itemName': sellItem.itemName,
            initiatedAt: { $lt: sellExecution.initiatedAt }, // Bought before sold
          })
          .sort({ initiatedAt: 1 }) // Oldest first (FIFO)
          .exec();

        if (!matchedBuy) {
          this.logger.debug(
            `No matching purchase found for sell item: ${sellItem.itemName}`,
          );
          continue;
        }

        // Find the matching item in the buy execution
        const buyItem = matchedBuy.items.find(
          (item) => item.itemName === sellItem.itemName,
        );

        if (!buyItem) {
          this.logger.warn(
            `Item mismatch in buy execution ${matchedBuy.executionId} for ${sellItem.itemName}`,
          );
          continue;
        }

        // Price validation: Check if sell price is within ±50% of buy price
        const priceRatio = sellItem.value / buyItem.value;
        if (priceRatio < 0.5 || priceRatio > 1.5) {
          this.logger.warn(
            `Price difference too large for ${sellItem.itemName}: buy ${buyItem.value}, sell ${sellItem.value} (ratio: ${priceRatio})`,
          );
          // Still match it, but log the warning
        }

        const profit = sellItem.value - buyItem.value;

        // Link the executions
        await this.executionModel.updateOne(
          { _id: matchedBuy._id },
          { $set: { matchedToOutboundId: sellExecution.executionId } },
        );

        await this.executionModel.updateOne(
          { _id: sellExecution._id },
          {
            $set: {
              matchedToInboundId: matchedBuy.executionId,
              realizedValue: profit,
            },
          },
        );

        matchCount++;

        this.logger.log(
          `Matched sell ${sellExecution.executionId} (${sellItem.itemName}) to buy ${matchedBuy.executionId} - Profit: ${profit.toFixed(2)}`,
        );
      }

      if (matchCount > 0) {
        this.logger.log(
          `Auto-matched ${matchCount} items for sell execution ${sellExecution.executionId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error matching sell to purchase: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manually match a sell execution to a specific purchase execution
   * Used by user-initiated matching via API
   */
  async manualMatchExecutions(
    sellExecutionId: string,
    purchaseExecutionId: string,
    userId: Types.ObjectId,
  ): Promise<void> {
    const sellExecution = await this.executionModel.findOne({
      executionId: sellExecutionId,
      userId,
    });

    const purchaseExecution = await this.executionModel.findOne({
      executionId: purchaseExecutionId,
      userId,
    });

    if (!sellExecution || !purchaseExecution) {
      throw new Error('One or both executions not found');
    }

    // Calculate profit based on total execution values
    const profit = sellExecution.totalAmount - purchaseExecution.totalAmount;

    // Update both executions
    await this.executionModel.updateOne(
      { _id: purchaseExecution._id },
      { $set: { matchedToOutboundId: sellExecution.executionId } },
    );

    await this.executionModel.updateOne(
      { _id: sellExecution._id },
      {
        $set: {
          matchedToInboundId: purchaseExecution.executionId,
          realizedValue: profit,
        },
      },
    );

    this.logger.log(
      `Manually matched sell ${sellExecutionId} to purchase ${purchaseExecutionId} - Profit: ${profit.toFixed(2)}`,
    );
  }

  /**
   * Unmatch a execution (remove the purchase-sale link)
   */
  async unmatchExecution(executionId: string, userId: Types.ObjectId): Promise<void> {
    const execution = await this.executionModel.findOne({ executionId, userId });

    if (!execution) {
      throw new Error('Execution not found');
    }

    // If this is a sell execution, unmatch from purchase
    if (execution.matchedToInboundId) {
      await this.executionModel.updateOne(
        { executionId: execution.matchedToInboundId },
        { $unset: { matchedToOutboundId: '' } },
      );
    }

    // If this is a buy execution, unmatch from sale
    if (execution.matchedToOutboundId) {
      await this.executionModel.updateOne(
        { executionId: execution.matchedToOutboundId },
        {
          $unset: {
            matchedToInboundId: '',
            realizedValue: '',
          },
        },
      );
    }

    // Clear matching fields on this execution
    await this.executionModel.updateOne(
      { _id: execution._id },
      {
        $unset: {
          matchedToOutboundId: '',
          matchedToInboundId: '',
          realizedValue: '',
        },
      },
    );

    this.logger.log(`Unmatched execution ${executionId}`);
  }

  /**
   * Mark a execution as manually purchased
   * Allows users to mark items they bought themselves or via system that weren't detected
   */
  async markAsManualPurchase(
    executionId: string,
    userId: Types.ObjectId,
    purchaseSource: 'system' | 'manual',
    purchasePrice?: number,
    purchaseDate?: Date,
    notes?: string,
  ): Promise<void> {
    const execution = await this.executionModel.findOne({ executionId, userId });

    if (!execution) {
      throw new Error('Execution not found');
    }

    // Update execution with manual purchase information
    await this.executionModel.updateOne(
      { _id: execution._id },
      {
        $set: {
          isManuallyAdjusted: true,
          manualSource: purchaseSource,
          manualInboundValue: purchasePrice || execution.totalAmount,
          manualInboundDate: purchaseDate || execution.initiatedAt,
          userNotes: notes,
          // If marking as purchased, ensure it's marked as INBOUND
          transactionType: 'INBOUND',
        },
      },
    );

    this.logger.log(
      `Marked execution ${executionId} as manual purchase (source: ${purchaseSource})`,
    );
  }

  /**
   * Remove manual purchase marking from a execution
   */
  async removeManualPurchase(
    executionId: string,
    userId: Types.ObjectId,
  ): Promise<void> {
    const execution = await this.executionModel.findOne({ executionId, userId });

    if (!execution) {
      throw new Error('Execution not found');
    }

    await this.executionModel.updateOne(
      { _id: execution._id },
      {
        $set: {
          isManuallyAdjusted: false,
        },
        $unset: {
          manualSource: '',
          manualInboundValue: '',
          manualInboundDate: '',
          userNotes: '',
        },
      },
    );

    this.logger.log(`Removed manual purchase marking from execution ${executionId}`);
  }
}
