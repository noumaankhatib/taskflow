import type { Payment } from "@/schemas/entities";
export type PaymentView = Payment & { effectiveStatus: Payment["status"]; outstanding: number };
