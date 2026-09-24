export interface BankBranding {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  headerGradient: string;
  accentBorder: string;
  iconText: string;
}

export const POPULAR_BANKS = [
  'Nubank',
  'Itaú',
  'Santander',
  'Banco Inter',
  'Bradesco',
  'Banco do Brasil',
  'C6 Bank',
  'Caixa',
  'XP Investimentos',
  'BTG Pactual',
  'Mercado Pago',
  'PicPay',
] as const;

export const getBankBranding = (rawBank?: string): BankBranding => {
  const bank = (rawBank || '').trim().toLowerCase();

  // Nubank
  if (bank.includes('nu') || bank.includes('rox') || bank.includes('purple')) {
    return {
      id: 'nubank',
      name: 'Nubank',
      shortName: 'NU',
      primaryColor: '#8A05BE',
      secondaryColor: '#A855F7',
      badgeBg: 'rgba(138, 5, 190, 0.18)',
      badgeBorder: 'rgba(168, 85, 247, 0.45)',
      textColor: '#E9D5FF',
      headerGradient: 'linear-gradient(90deg, rgba(138, 5, 190, 0.22) 0%, rgba(15, 23, 42, 0.7) 100%)',
      accentBorder: '#9333EA',
      iconText: '🟣',
    };
  }

  // Itaú
  if (bank.includes('itau') || bank.includes('itaú') || bank.includes('itaucard')) {
    return {
      id: 'itau',
      name: 'Itaú',
      shortName: 'IT',
      primaryColor: '#EC7000',
      secondaryColor: '#F97316',
      badgeBg: 'rgba(236, 112, 0, 0.18)',
      badgeBorder: 'rgba(249, 115, 22, 0.45)',
      textColor: '#FFEDD5',
      headerGradient: 'linear-gradient(90deg, rgba(236, 112, 0, 0.22) 0%, rgba(15, 23, 42, 0.7) 100%)',
      accentBorder: '#EA580C',
      iconText: '🟧',
    };
  }

  // Santander
  if (bank.includes('santander') || bank.includes('sx')) {
    return {
      id: 'santander',
      name: 'Santander',
      shortName: 'SAN',
      primaryColor: '#EA1D2C',
      secondaryColor: '#EF4444',
      badgeBg: 'rgba(234, 29, 44, 0.18)',
      badgeBorder: 'rgba(239, 68, 68, 0.45)',
      textColor: '#FEE2E2',
      headerGradient: 'linear-gradient(90deg, rgba(234, 29, 44, 0.22) 0%, rgba(15, 23, 42, 0.7) 100%)',
      accentBorder: '#DC2626',
      iconText: '🔴',
    };
  }

  // Banco Inter
  if (bank.includes('inter')) {
    return {
      id: 'inter',
      name: 'Banco Inter',
      shortName: 'INT',
      primaryColor: '#FF7A00',
      secondaryColor: '#FB923C',
      badgeBg: 'rgba(255, 122, 0, 0.18)',
      badgeBorder: 'rgba(251, 146, 60, 0.45)',
      textColor: '#FFEDD5',
      headerGradient: 'linear-gradient(90deg, rgba(255, 122, 0, 0.22) 0%, rgba(15, 23, 42, 0.7) 100%)',
      accentBorder: '#F97316',
      iconText: '🟠',
    };
  }

  // Bradesco
  if (bank.includes('bradesco') || bank.includes('prime')) {
    return {
      id: 'bradesco',
      name: 'Bradesco',
      shortName: 'BRA',
      primaryColor: '#CC092F',
      secondaryColor: '#F43F5E',
      badgeBg: 'rgba(204, 9, 47, 0.18)',
      badgeBorder: 'rgba(244, 63, 94, 0.45)',
      textColor: '#FFE4E6',
      headerGradient: 'linear-gradient(90deg, rgba(204, 9, 47, 0.22) 0%, rgba(15, 23, 42, 0.7) 100%)',
      accentBorder: '#E11D48',
      iconText: '🟥',
    };
  }

  // Banco do Brasil / BB
  if (bank.includes('brasil') || bank.includes('bb') || bank.includes('ourocard')) {
    return {
      id: 'bb',
      name: 'Banco do Brasil',
      shortName: 'BB',
      primaryColor: '#FACC15',
      secondaryColor: '#2563EB',
      badgeBg: 'rgba(250, 204, 21, 0.18)',
      badgeBorder: 'rgba(250, 204, 21, 0.45)',
      textColor: '#FEF08A',
      headerGradient: 'linear-gradient(90deg, rgba(250, 204, 21, 0.18) 0%, rgba(37, 99, 235, 0.15) 100%)',
      accentBorder: '#EAB308',
      iconText: '🟡',
    };
  }

  // C6 Bank
  if (bank.includes('c6')) {
    return {
      id: 'c6',
      name: 'C6 Bank',
      shortName: 'C6',
      primaryColor: '#475569',
      secondaryColor: '#0EA5E9',
      badgeBg: 'rgba(71, 85, 105, 0.25)',
      badgeBorder: 'rgba(148, 163, 184, 0.45)',
      textColor: '#F1F5F9',
      headerGradient: 'linear-gradient(90deg, rgba(51, 65, 85, 0.3) 0%, rgba(15, 23, 42, 0.8) 100%)',
      accentBorder: '#38BDF8',
      iconText: '⚫',
    };
  }

  // Caixa
  if (bank.includes('caixa') || bank.includes('cef')) {
    return {
      id: 'caixa',
      name: 'Caixa Econômica',
      shortName: 'CX',
      primaryColor: '#0284C7',
      secondaryColor: '#38BDF8',
      badgeBg: 'rgba(2, 132, 199, 0.18)',
      badgeBorder: 'rgba(56, 189, 248, 0.45)',
      textColor: '#E0F2FE',
      headerGradient: 'linear-gradient(90deg, rgba(2, 132, 199, 0.22) 0%, rgba(15, 23, 42, 0.7) 100%)',
      accentBorder: '#0284C7',
      iconText: '🔵',
    };
  }

  // XP Investimentos
  if (bank.includes('xp')) {
    return {
      id: 'xp',
      name: 'XP Investimentos',
      shortName: 'XP',
      primaryColor: '#EAB308',
      secondaryColor: '#F59E0B',
      badgeBg: 'rgba(234, 179, 8, 0.18)',
      badgeBorder: 'rgba(245, 158, 11, 0.45)',
      textColor: '#FEF3C7',
      headerGradient: 'linear-gradient(90deg, rgba(234, 179, 8, 0.2) 0%, rgba(15, 23, 42, 0.75) 100%)',
      accentBorder: '#F59E0B',
      iconText: '🟡',
    };
  }

  // BTG Pactual
  if (bank.includes('btg')) {
    return {
      id: 'btg',
      name: 'BTG Pactual',
      shortName: 'BTG',
      primaryColor: '#1E3A8A',
      secondaryColor: '#3B82F6',
      badgeBg: 'rgba(30, 58, 138, 0.25)',
      badgeBorder: 'rgba(59, 130, 246, 0.45)',
      textColor: '#DBEAFE',
      headerGradient: 'linear-gradient(90deg, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0.7) 100%)',
      accentBorder: '#2563EB',
      iconText: '🔷',
    };
  }

  // PicPay
  if (bank.includes('picpay')) {
    return {
      id: 'picpay',
      name: 'PicPay',
      shortName: 'PP',
      primaryColor: '#10B981',
      secondaryColor: '#34D399',
      badgeBg: 'rgba(16, 185, 129, 0.18)',
      badgeBorder: 'rgba(52, 211, 153, 0.45)',
      textColor: '#D1FAE5',
      headerGradient: 'linear-gradient(90deg, rgba(16, 185, 129, 0.22) 0%, rgba(15, 23, 42, 0.7) 100%)',
      accentBorder: '#059669',
      iconText: '🟢',
    };
  }

  // Mercado Pago
  if (bank.includes('mercado') || bank.includes('mp')) {
    return {
      id: 'mercadopago',
      name: 'Mercado Pago',
      shortName: 'MP',
      primaryColor: '#009EE3',
      secondaryColor: '#38BDF8',
      badgeBg: 'rgba(0, 158, 227, 0.18)',
      badgeBorder: 'rgba(56, 189, 248, 0.45)',
      textColor: '#E0F2FE',
      headerGradient: 'linear-gradient(90deg, rgba(0, 158, 227, 0.22) 0%, rgba(15, 23, 42, 0.7) 100%)',
      accentBorder: '#0284C7',
      iconText: '🤝',
    };
  }

  // Default fallback for any other bank or card
  const cleanName = rawBank || 'Cartão de Crédito';
  return {
    id: 'generic',
    name: cleanName,
    shortName: cleanName.slice(0, 3).toUpperCase(),
    primaryColor: '#6366F1',
    secondaryColor: '#818CF8',
    badgeBg: 'rgba(99, 102, 241, 0.18)',
    badgeBorder: 'rgba(129, 140, 248, 0.45)',
    textColor: '#E0E7FF',
    headerGradient: 'linear-gradient(90deg, rgba(99, 102, 241, 0.22) 0%, rgba(15, 23, 42, 0.7) 100%)',
    accentBorder: '#4F46E5',
    iconText: '💳',
  };
};
