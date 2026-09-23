export type MovementType =
  | 'RECEITA'
  | 'DESPESA'
  | 'RECEBER'
  | 'PAGAR'
  | 'EMPRESTIMO'
  | 'CARTAO';

export type MovementStatus = 'PREVISTA' | 'REALIZADA';

export interface InvoiceNatureItemBreakdown {
  id: string;
  natureId?: string;
  natureName: string;
  mappingId?: string;
  mappingItemId?: string;
  description: string;
  amount: number;
  isAnalyzed: boolean;
  installments?: number;
  currentInstallment?: number;
  finalAmount?: number;
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
  date?: string;
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
  nature?: string;
  cardId?: string;
  mappingId?: string;
  mappingItemId?: string;
  invoiceBreakdown?: InvoiceNatureItemBreakdown[];
  unanalyzedAmount?: number;
}

export interface MappingItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
  unit?: string;
  multiplierWeeks: number;
  totalValue: number;
  realizedValue?: number;
  isFulfilled?: boolean;
  paymentMethod?: 'CONTA' | 'CARTAO' | 'BOLETO' | 'PIX';
  cardName?: string;
}

export interface FixedExpenseMapping {
  id: string;
  name: string;
  natureId: string;
  icon?: string;
  applicableMonths?: number[];
  items: MappingItem[];
  frequency?: 'SEMANAL' | 'QUINZENAL' | 'MENSAL' | 'PONTUAL';
  dayOfWeek?: string;
  dayOfMonth?: number;
}

export interface CeilingJustificationRecord {
  id: string;
  date: string;
  month: string;
  ceilingAmount: number;
  spentAmount: number;
  reason: string;
}

export interface ExpenseNature {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: 'FIXA' | 'VARIAVEL' | 'ESSENCIAL';
  initialBudget?: number;
  monthlyCeiling?: number;
  description?: string;
  mappings: FixedExpenseMapping[];
  overCeilingJustification?: string;
  justificationHistory?: CeilingJustificationRecord[];
}

export interface Goal {
  id: string;
  title: string;
  category: string;
  currentAmount: number;
  targetAmount: number;
  monthlyContribution?: number;
  targetDate?: string;
  deadline?: string;
  icon?: string;
  color?: string;
}

export type BankAccountType = 'CORRENTE' | 'INVESTIMENTO' | 'POUPANCA' | 'CARTEIRA' | 'CHECKING' | 'INVESTMENT' | 'CASH' | 'OUTRO';

export interface BankAccount {
  id: string;
  name: string;
  bank?: string;
  bankName?: string;
  type: BankAccountType;
  balance: number;
  initialBalance?: number;
  color: string;
  icon?: string;
}

export type Account = BankAccount;

export type CardBrand = 'MASTERCARD' | 'VISA' | 'ELO' | 'AMEX' | 'HIPERCARD' | 'OUTRA';

export interface CreditCardItem {
  id: string;
  name: string;
  bank: string;
  brand?: CardBrand;
  limit: number;
  limitTotal?: number;
  limitUsed?: number;
  closingDay: number;
  dueDay: number;
  color: string;
}

export type Card = CreditCardItem;

export type PaymentMethodType =
  | 'PIX'
  | 'BOLETO'
  | 'CARTAO_CREDITO'
  | 'CARTAO_DEBITO'
  | 'DINHEIRO'
  | 'TRANSFERENCIA'
  | 'OUTRO';

export interface PaymentMethodItem {
  id: string;
  name: string;
  type: PaymentMethodType;
  linkedAccountId?: string;
  linkedCardId?: string;
  icon?: string;
  color?: string;
  creditLimit?: number;
  closingDay?: number;
  dueDay?: number;
}

export type SalaryContractType = 'CLT' | 'PJ' | 'PRO_LABORE' | 'ESTAGIO' | 'CONCURSO' | 'AUTONOMO' | 'OUTRO';
export type SalaryPaymentSchedule = 'UNICO' | 'QUINZENAL' | 'SEMANAL';
export type SalaryAdjustmentReason =
  | 'DISSÍDIO_CONVENÇÃO'
  | 'MÉRITO'
  | 'PROMOÇÃO'
  | 'MUDANÇA_EMPREGO'
  | 'INFLAÇÃO_CORREÇÃO'
  | 'OUTRO'
  | string;

export interface SalaryAdjustment {
  id: string;
  effectiveDate: string;
  grossAmount?: number;
  netAmount?: number;
  newAmount?: number;
  percentageIncrease?: number;
  reason: SalaryAdjustmentReason;
  title?: string;
  notes?: string;
  firstInstallmentAmount?: number;
  secondInstallmentAmount?: number;
  weeklyInstallmentAmount?: number;
  installmentValueMode?: 'FIXED' | 'AUTO';
}

export interface SalaryContract {
  id: string;
  employer?: string;
  companyName?: string;
  role?: string;
  roleTitle?: string;
  contractType: SalaryContractType;
  paymentSchedule?: SalaryPaymentSchedule;
  paymentDay?: number;
  secondPaymentDay?: number;
  firstPaymentDay?: number;
  firstPaymentPercent?: number;
  secondPaymentPercent?: number;
  weeklyPaymentDayOfWeek?: number;
  firstInstallmentPercent?: number;
  firstInstallmentAmount?: number;
  secondInstallmentAmount?: number;
  weeklyInstallmentAmount?: number;
  installmentValueMode?: 'FIXED' | 'AUTO';
  baseAmount?: number;
  currentGrossAmount?: number;
  currentNetAmount?: number;
  receivingBankAccountId?: string;
  receivingBankName?: string;
  startDate?: string;
  isActive?: boolean;
  active?: boolean;
  history?: SalaryAdjustment[];
  adjustments?: SalaryAdjustment[];
}

export interface CheckpointCardInvoice {
  monthIndex: number;
  monthLabel: string;
  dueDate: string;
  amount: number;
  breakdown?: InvoiceNatureItemBreakdown[];
  unanalyzedAmount?: number;
}

export interface CheckpointBankDebt {
  id: string;
  cardId?: string;
  bankName: string;
  cardName: string;
  dueDay: number;
  invoices?: CheckpointCardInvoice[];
  totalDebt: number;
  invoiceAmount?: number;
}

export interface FinancialCheckpoint {
  id: string;
  title?: string;
  createdAt?: string;
  startDate?: string;
  date?: string;
  initialBalance?: number;
  creditCardDebt?: number;
  cardDueDate?: string;
  cardName?: string;
  cardInstallments?: number;
  cardInstallmentAmount?: number;
  cardDebts?: any[];
  accounts?: any[];
  totalAssets?: number;
  totalLiabilities?: number;
  netWorth?: number;
  initialNetWorth?: number;
  label?: string;
  notes?: string;
  isActive?: boolean;
}

export type Checkpoint = FinancialCheckpoint;

export interface LoanSpreadsheetRow {
  month: number;
  dueDate: string;
  installmentValue: number;
  interestValue: number;
  amortizationValue: number;
  balanceRemaining: number;
  payoffTodayValue: number;
  savingsAtAdvance: number;
  simDate?: string;
  monthsDiff?: number;
  discountedPayoff?: number;
  isPaid?: boolean;
  movementId?: string;
}

export interface LoanSpreadsheetSummary {
  principalAmount: number;
  monthlyInterestRate: number;
  termMonths: number;
  contractDate: string;
  firstDueDate: string;
  simulationDate?: string;
  installmentValue: number;
  totalCost: number;
  totalInterest: number;
  totalPayoffToday: number;
  totalSavingsPotential: number;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actionBadge?: string;
  suggestedFollowUps?: string[];
}

export interface AppUser {
  $id: string;
  name: string;
  email: string;
  isGuest?: boolean;
}
