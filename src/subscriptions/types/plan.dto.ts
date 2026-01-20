// src/subscriptions/types/plan.dto.ts
export interface SubscriptionPlanDto {
  model: string;
  label: string;
  description: string;
  costInEuro: number;
  durationInDays: number;
  feature: 'PREMIUM' | 'ENTERPRISE';
  highlight?: boolean;
  isTrial?: boolean;

  // berechnete Felder:
  discountedCostInEuro?: number; // z.B. 157.5 statt 175
  discountPercent?: number; // z.B. 10
  promoLabel?: string; // "Launch -10%"
  promoDescription?: string; // optional langer Text
  originalCostInEuro?: number; // = costInEuro (später hilfreich im UI)
}
