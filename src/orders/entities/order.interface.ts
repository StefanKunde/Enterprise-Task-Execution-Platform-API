// src/orders/order.entity.ts
export interface Order {
  orderId: string;
  userId: string;
  cart: {
    model: '7_DAYS' | '14_DAYS' | '1_MONTH' | '1_YEAR' | 'AA_1_MONTH';
    feature: 'PREMIUM' | 'ENTERPRISE';
    label: string;
    costInEuro: number;
    durationInDays: number;
  }[];
  euroTotal: number;
  status:
    | 'pending'
    | 'confirming'
    | 'finished'
    | 'failed'
    | 'expired'
    | 'partially_paid';
  paymentId?: number;
}
