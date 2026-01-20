import {
  Injectable,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
} from './entities/subscription.schema';
import { UsersService } from 'src/users/users.service';
import {
  SubscriptionPlan,
  SubscriptionPlanDocument,
} from './entities/subscription-plan.schema';
import { Promotion, PromotionDocument } from './entities/promotion.schema';
import { SubscriptionPlanDto } from './types/plan.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionPlan.name)
    private readonly planModel: Model<SubscriptionPlanDocument>,
    @InjectModel(Promotion.name)
    private readonly promoModel: Model<PromotionDocument>,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  private isPromoActive(p: Promotion, now = new Date()): boolean {
    if (p.active === false) return false;
    if (p.startAt && now < p.startAt) return false;
    if (p.endAt && now > p.endAt) return false;
    return true;
  }

  async getPlanWithFinalPrice(
    model: string,
    feature: 'PREMIUM' | 'ENTERPRISE',
  ): Promise<{
    plan: SubscriptionPlan;
    finalPrice: number;
    appliedPromo: string | null;
  }> {
    // if your existing method is private, inline its logic or call it directly here
    const plan = await this.planModel.findOne({ model, feature }).lean();
    if (!plan)
      throw new BadRequestException('Invalid subscription model or feature');

    const promos = await this.promoModel.find().lean().exec();
    const promo = this.bestPromoForPlan(plan as any, promos);
    const { discounted } = this.applyPromo(plan.costInEuro, promo);

    const finalPrice = discounted ?? plan.costInEuro;
    const appliedPromo = promo?.code ?? null;

    return { plan: plan as SubscriptionPlan, finalPrice, appliedPromo };
  }

  private bestPromoForPlan(
    plan: SubscriptionPlan,
    promos: Promotion[],
  ): Promotion | null {
    const candidates = promos.filter((p) => {
      if (!this.isPromoActive(p)) return false;
      if (p.appliesTo === 'GLOBAL') return true;
      if (p.appliesTo === 'FEATURE') return p.feature === plan.feature;
      if (p.appliesTo === 'PLAN_MODELS')
        return (p.planModels || []).includes(plan.model);
      return false;
    });

    if (candidates.length === 0) return null;

    // Select promo with highest value (first by priority, then absolute euro discount)
    return candidates
      .map((p) => ({ p, sortKey: p.priority ?? 0 }))
      .sort((a, b) => b.sortKey - a.sortKey)[0].p;
  }

  private applyPromo(
    cost: number,
    promo: Promotion | null,
  ): { discounted?: number; percent?: number } {
    if (!promo) return { discounted: undefined, percent: undefined };

    if (promo.type === 'PERCENT') {
      // Prozent-Rabatt, 2 Nachkommastellen runden
      const discounted = Math.max(
        0,
        Math.round(cost * (1 - promo.value / 100) * 100) / 100,
      );
      return { discounted, percent: promo.value };
    }

    // FIXED: fixed euro amount, round to 2 decimal places
    const discounted = Math.max(
      0,
      Math.round((cost - promo.value) * 100) / 100,
    );
    return { discounted, percent: undefined };
  }

  private async resolvePlanAndPrice(
    model: string,
    feature: 'PREMIUM' | 'ENTERPRISE',
  ) {
    const plan = await this.planModel.findOne({ model, feature }).lean();
    if (!plan)
      throw new BadRequestException('Invalid subscription model or feature');

    // (trial): trial is always free, ignore promos
    if (plan.isTrial) {
      return { plan, finalPrice: 0, appliedPromo: null };
    }

    const promos = await this.promoModel.find().lean().exec();
    const promo = this.bestPromoForPlan(plan as any, promos);
    const { discounted } = this.applyPromo(plan.costInEuro, promo);
    const finalPrice = discounted ?? plan.costInEuro;
    const appliedPromo = promo?.code ?? null;

    return { plan, finalPrice, appliedPromo };
  }

  async getAvailablePlans(): Promise<SubscriptionPlanDto[]> {
    const [plans, promos] = await Promise.all([
      this.planModel.find().sort({ durationInDays: 1 }).lean().exec(),
      this.promoModel.find().lean().exec(),
    ]);

    return plans.map((plan) => {
      // NEW: pass through trial flag
      const dto: SubscriptionPlanDto = {
        model: plan.model,
        label: plan.label,
        description: plan.description,
        costInEuro: plan.costInEuro,
        durationInDays: plan.durationInDays,
        feature: plan.feature,
        highlight: plan.highlight,
        isTrial: !!plan.isTrial,
      };

      if (!plan.isTrial) {
        const promo = this.bestPromoForPlan(plan as any, promos);
        const { discounted, percent } = this.applyPromo(plan.costInEuro, promo);
        if (discounted !== undefined) {
          dto.originalCostInEuro = plan.costInEuro;
          dto.discountedCostInEuro = discounted;
          dto.discountPercent =
            percent ??
            Math.round(
              ((plan.costInEuro - discounted) / plan.costInEuro) * 100,
            );
          dto.promoLabel = promo?.label;
          dto.promoDescription = promo?.description;
        }
      } else {
        // trial shows as 0.00, no promo fields
        dto.costInEuro = 0;
      }
      return dto;
    });
  }

  async createSubscription(
    userId: string,
    model: string,
  ): Promise<Subscription> {
    const modelDetails = {
      '7_DAYS': { cost: 50, duration: 7 },
      '14_DAYS': { cost: 95, duration: 14 },
      '1_MONTH': { cost: 175, duration: 30 },
      '1_YEAR': { cost: 1799, duration: 365 },
    }[model];

    if (!modelDetails) throw new BadRequestException('Ungültiges Abo-Modell');

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + modelDetails.duration * 86400000,
    );

    return this.subscriptionModel.create({
      userId,
      model,
      costInEuro: modelDetails.cost,
      startedAt: now,
      expiresAt,
    });
  }

  async getActiveSubscription(userId: string, feature: 'PREMIUM' | 'ENTERPRISE') {
    const now = new Date();
    return this.subscriptionModel
      .findOne({
        userId: new Types.ObjectId(userId),
        feature,
        expiresAt: { $gt: now },
      })
      .sort({ expiresAt: -1 })
      .lean()
      .exec();
  }

  async hasAnyTrialEver(userId: string) {
    return !!(await this.subscriptionModel.exists({
      userId: new Types.ObjectId(userId),
      isTrial: true,
    }));
  }

  async hasAnyActivePremium(userId: string) {
    return !!(await this.getActiveSubscription(userId, 'PREMIUM'));
  }

  async getUserSubscriptions(userId: string): Promise<SubscriptionDocument[]> {
    return this.subscriptionModel.find({ userId }).sort({ startedAt: -1 });
  }

  async hasActiveSubscription(userId: string, feature: 'PREMIUM' | 'ENTERPRISE') {
    const active = await this.getActiveSubscription(userId, feature);
    return !!active;
  }

  // Returns all subscriptions for a user, sorted by start date descending
  async getHistoryForUser(userId: string): Promise<Subscription[]> {
    return this.subscriptionModel
      .find({ userId })
      .sort({ startedAt: -1 })
      .exec();
  }

  async createOrExtendSubscription(
    userId: string,
    model: string,
    feature: 'PREMIUM' | 'ENTERPRISE',
  ) {
    const { plan, finalPrice } = await this.resolvePlanAndPrice(model, feature);

    // Trial guards
    if (plan.isTrial) {
      if (await this.hasAnyTrialEver(userId)) {
        throw new BadRequestException('Trial already used.');
      }
      if (await this.hasAnyActivePremium(userId)) {
        throw new BadRequestException(
          'Trial not available for active subscribers.',
        );
      }
      const u = await this.usersService.findById(userId);
      if (!u?.discordJoinVerifiedAt) {
        throw new BadRequestException(
          'Please join our Discord first (Connect → Join → Verify) before activating the trial.',
        );
      }
    }

    const now = new Date();
    const activeSub = await this.getActiveSubscription(userId, feature);

    // Trial never "extends" from the future; it starts now for 24h
    const startedAt = plan.isTrial
      ? now
      : activeSub?.expiresAt && activeSub.expiresAt > now
        ? activeSub.expiresAt
        : now;

    const expiresAt = plan.isTrial
      ? new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24h exact
      : new Date(startedAt.getTime() + plan.durationInDays * 86400000);

    return this.subscriptionModel.create({
      userId: new Types.ObjectId(userId),
      model: plan.model,
      feature: plan.feature,
      costInEuro: finalPrice, // 0 for trial
      startedAt,
      expiresAt,
      isTrial: !!plan.isTrial,
    });
  }
  async activateTrial(
    userId: string,
    model: string,
    feature: 'PREMIUM' | 'ENTERPRISE',
  ) {
    // Must be a plan flagged as trial
    const plan = await this.planModel.findOne({ model, feature }).lean();
    if (!plan || !plan.isTrial) {
      throw new BadRequestException();
    }

    // Must never have had ANY trial before (across features/models)
    const hadTrial = await this.subscriptionModel.exists({
      userId: new Types.ObjectId(userId),
      isTrial: true,
    });
    if (hadTrial) {
      throw new BadRequestException('Trial already used.');
    }

    // Forbid trial if the user already has any active subscription
    const hasActivePremium = await this.getActiveSubscription(userId, 'PREMIUM');
    if (hasActivePremium) {
      throw new BadRequestException(
        'Trial not available for active subscribers.',
      );
    }

    // Discord verification requirement
    const u = await this.usersService.findById(userId);
    if (!u?.discordJoinVerifiedAt) {
      throw new BadRequestException(
        'Please join our Discord first (Connect → Join → Verify) before activating the trial.',
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h

    return this.subscriptionModel.create({
      userId: new Types.ObjectId(userId),
      model: plan.model,
      feature: plan.feature,
      costInEuro: 0,
      startedAt: now,
      expiresAt,
      isTrial: true,
    });
  }
}
