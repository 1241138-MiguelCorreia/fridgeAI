export const Colors = {
  // Primária — verde fresco
  primary: '#22C55E',
  primaryDark: '#16A34A',
  primaryLight: '#DCFCE7',

  // Secundária
  secondary: '#F97316',
  secondaryLight: '#FFEDD5',

  // Neutros
  white: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Texto
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textOnPrimary: '#FFFFFF',

  // Estados / Prioridade
  urgentRed: '#EF4444',
  urgentRedLight: '#FEF2F2',
  warnYellow: '#F59E0B',
  warnYellowLight: '#FFFBEB',
  okGreen: '#22C55E',
  okGreenLight: '#DCFCE7',
  stockBlue: '#3B82F6',
  stockBlueLight: '#EFF6FF',

  // Locais
  fridgeBlue: '#06B6D4',
  fridgeBlueLight: '#ECFEFF',
  pantryOrange: '#F97316',
  pantryOrangeLight: '#FFEDD5',
  freezerPurple: '#8B5CF6',
  freezerPurpleLight: '#EDE9FE',

  // Erros e sucesso
  error: '#EF4444',
  errorLight: '#FEF2F2',
  success: '#22C55E',
  successLight: '#DCFCE7',

  // Overlay
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.1)',
};

export const PriorityColors = {
  usar_hoje: { bg: Colors.urgentRedLight, text: Colors.urgentRed, dot: Colors.urgentRed },
  usar_breve: { bg: Colors.warnYellowLight, text: Colors.warnYellow, dot: Colors.warnYellow },
  pode_esperar: { bg: Colors.okGreenLight, text: Colors.okGreen, dot: Colors.okGreen },
  stock: { bg: Colors.stockBlueLight, text: Colors.stockBlue, dot: Colors.stockBlue },
};

export const LocationColors = {
  'frigorífico': { bg: Colors.fridgeBlueLight, text: Colors.fridgeBlue, icon: '🧊' },
  despensa: { bg: Colors.pantryOrangeLight, text: Colors.pantryOrange, icon: '🍞' },
  congelador: { bg: Colors.freezerPurpleLight, text: Colors.freezerPurple, icon: '❄️' },
};
