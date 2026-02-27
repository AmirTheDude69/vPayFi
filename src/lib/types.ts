import type { EarningCategory, Person } from "@prisma/client";

export interface CreateEarningInput {
  category: EarningCategory;
  source: string;
  receiver: Person;
  amount: number;
  date: string;
}

export interface UpdateEarningInput extends CreateEarningInput {
  id: string;
}

export interface CreateExpenseInput {
  name: string;
  spender: Person;
  amount: number;
  date: string;
}

export interface UpdateExpenseInput extends CreateExpenseInput {
  id: string;
}

export interface CreatePayoutInput {
  category: EarningCategory;
  name: string;
  receiver: Person;
  amount: number;
  date: string;
}

export interface UpdatePayoutInput extends CreatePayoutInput {
  id: string;
}

export interface EarningRecord {
  id: string;
  category: EarningCategory;
  source: string;
  receiver: Person;
  amountCents: number;
  receivedDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseRecord {
  id: string;
  name: string;
  spender: Person;
  amountCents: number;
  spentDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutRecord {
  id: string;
  category: EarningCategory;
  name: string;
  receiver: Person;
  amountCents: number;
  paidDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsResponse {
  totals: {
    earningsCents: number;
    expensesCents: number;
    payoutsCents: number;
    netCents: number;
    holdingsCents: number;
  };
  perPerson: Array<{
    person: Person;
    earningsCents: number;
    expensesCents: number;
    netCents: number;
  }>;
  categorySplit: Array<{
    category: EarningCategory;
    amountCents: number;
  }>;
  monthly: Array<{
    month: string;
    label: string;
    earningsCents: number;
    expensesCents: number;
    netCents: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: "earning" | "expense" | "payout";
    name: string;
    person: Person;
    amountCents: number;
    date: string | null;
  }>;
  teamEarnings: Array<{
    person: Person;
    payoutCents: number;
  }>;
}
