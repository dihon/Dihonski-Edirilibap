// Design tokens from /app/design_guidelines.json
export const COLORS = {
  surface: '#FDFDF9',
  onSurface: '#1E201B',
  surfaceSecondary: '#FFFFFF',
  onSurfaceSecondary: '#1E201B',
  surfaceTertiary: '#F1F3EA',
  onSurfaceTertiary: '#2E3A24',
  surfaceInverse: '#2B3624',
  onSurfaceInverse: '#FFFFFF',
  brand: '#2B8A44',
  brandPrimary: '#2B8A44',
  onBrandPrimary: '#FFFFFF',
  brandSecondary: '#E8702A',
  onBrandSecondary: '#FFFFFF',
  brandTertiary: '#E2F1E5',
  onBrandTertiary: '#1C592C',
  success: '#28A745',
  onSuccess: '#FFFFFF',
  warning: '#FFB020',
  onWarning: '#1E201B',
  error: '#D94532',
  onError: '#FFFFFF',
  info: '#4A544A',
  onInfo: '#FFFFFF',
  border: '#E3E7DB',
  borderStrong: '#B4BEA6',
  divider: '#E3E7DB',
  muted: '#6A7363',
};

export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48,
};

export const RADIUS = { sm: 6, md: 12, lg: 20, pill: 999 };

export const FONT = { sm: 12, base: 14, lg: 16, xl: 20, '2xl': 24, '3xl': 30 };

// Max weight 500 per design rule
export const WEIGHT = { regular: '400' as const, medium: '500' as const };

export const SHADOW = {
  card: {
    shadowColor: '#1E201B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  soft: {
    shadowColor: '#1E201B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
};

type StatusMeta = { label: string; color: string; step: number };

export const RIDE_STATUS: Record<string, StatusMeta> = {
  requested: { label: 'Finding a driver', color: COLORS.warning, step: 0 },
  accepted: { label: 'Driver accepted', color: COLORS.info, step: 1 },
  arriving: { label: 'Driver is arriving', color: COLORS.brandSecondary, step: 2 },
  in_progress: { label: 'On the way', color: COLORS.brandPrimary, step: 3 },
  completed: { label: 'Completed', color: COLORS.success, step: 4 },
  cancelled: { label: 'Cancelled', color: COLORS.error, step: -1 },
};

export const ORDER_STATUS: Record<string, StatusMeta> = {
  requested: { label: 'Finding a rider', color: COLORS.warning, step: 0 },
  accepted: { label: 'Rider accepted', color: COLORS.info, step: 1 },
  shopping: { label: 'Buying your items', color: COLORS.brandSecondary, step: 2 },
  delivering: { label: 'Out for delivery', color: COLORS.brandPrimary, step: 3 },
  completed: { label: 'Delivered', color: COLORS.success, step: 4 },
  cancelled: { label: 'Cancelled', color: COLORS.error, step: -1 },
};

export const RIDE_FLOW = ['requested', 'accepted', 'arriving', 'in_progress', 'completed'];
export const ORDER_FLOW = ['requested', 'accepted', 'shopping', 'delivering', 'completed'];

export const peso = (n: number | null | undefined) =>
  `\u20B1${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
