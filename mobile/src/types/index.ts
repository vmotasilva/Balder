export type MovementType = 'RECEBER' | 'PAGAR' | 'EMPRESTIMO' | 'CARTAO';
export type MovementStatus = 'PREVISTA' | 'REALIZADA';

export interface InvoiceNatureItemBreakdown {
  id: string;
  description: string;
  amount: number;
  natureId: string;
  installments?: number;
  installmentIndex?: number;
}

export interface Movement {
  id: string;
  title: string;
  type: MovementType;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  bank: string;
  status: MovementStatus;
  category: string;
  notes?: string;
  installmentNumber?: number;
  installmentsTotal?: number;
  installmentGroupId?: string;
  interestRatePercent?: number;
  originalAmount?: number;
  actualAmount?: number;
  paymentDate?: string;
  adjustmentReason?: string;
  natureId?: string;
  invoiceBreakdown?: InvoiceNatureItemBreakdown[];
  unanalyzedAmount?: number;
}

export interface AccountDoc {
  id: string;
  name: string;
  bank: string;
  initialBalance: number;
  type?: 'CHECKING' | 'INVESTMENT' | 'CASH';
  color?: string;
}

export interface Checkpoint {
  id: string;
  date: string;
  balance: number;
  notes?: string;
}

export interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  category?: string;
  color?: string;
}

export interface Nature {
  id: string;
  name: string;
  type: 'RECEBER' | 'PAGAR' | 'INVESTIMENTO';
  color?: string;
  monthlyLimit?: number;
}

export interface AppUser {
  $id: string;
  name: string;
  email: string;
  isGuest?: boolean;
}
