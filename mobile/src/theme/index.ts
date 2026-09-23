export const theme = {
  colors: {
    background: '#0B0F17',
    backgroundSecondary: '#111827',
    surface: '#161F30',
    surfaceElevated: '#1E293B',
    border: '#1F293D',
    borderHighlight: '#334155',
    
    // Identidade Balder
    primary: '#06B6D4', // Ciano Balder
    primaryMuted: 'rgba(6, 182, 212, 0.15)',
    accent: '#38BDF8',
    
    // Status e Naturezas
    income: '#10B981', // Verde Esmeralda (Receitas)
    incomeMuted: 'rgba(16, 185, 129, 0.15)',
    expense: '#F43F5E', // Rosa/Vermelho (Despesas)
    expenseMuted: 'rgba(244, 63, 94, 0.15)',
    loan: '#F59E0B', // Âmbar (Empréstimos)
    loanMuted: 'rgba(245, 158, 11, 0.15)',
    card: '#A855F7', // Roxo (Cartão de Crédito)
    cardMuted: 'rgba(168, 85, 247, 0.15)',

    // Tipografia
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textInverse: '#0B0F17',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 9999,
  },
};

export type Theme = typeof theme;
