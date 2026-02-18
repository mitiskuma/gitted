import type {
  ThemeConfig,
  ThemeColors,
  ThemeGradients,
  ThemeAnimations,
  ThemeTypography,
  WrappedSlideType,
} from '@/lib/types';

// =============================================================================
// COLOR PALETTE — Deep purples, electric blues, neon greens, hot pinks
// =============================================================================

export const colors = {
  // Core brand
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7b2ff7',
    800: '#6d28d9',
    900: '#5b21b6',
    950: '#3b0764',
  },
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#0f1d4e',
    electric: '#00d4ff',
    neon: '#00e5ff',
  },
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    neon: '#39ff14',
    lime: '#a3ff12',
    mint: '#00ffab',
  },
  pink: {
    50: '#fdf2f8',
    100: '#fce7f3',
    200: '#fbcfe8',
    300: '#f9a8d4',
    400: '#f472b6',
    500: '#ec4899',
    600: '#db2777',
    700: '#be185d',
    800: '#9d174d',
    900: '#831843',
    hot: '#ff2d78',
    neon: '#ff1493',
    magenta: '#ff00ff',
  },
  // Dark backgrounds (game-first)
  dark: {
    50: '#1e1e2e',
    100: '#181825',
    200: '#14141f',
    300: '#11111b',
    400: '#0d0d14',
    500: '#0a0a0f',
    600: '#08080c',
    700: '#060609',
    800: '#040406',
    900: '#020203',
    void: '#000000',
  },
  // Neutrals with slight purple tint
  neutral: {
    50: '#f8f8fc',
    100: '#ededf5',
    200: '#d4d4e8',
    300: '#a8a8c8',
    400: '#7c7ca0',
    500: '#585880',
    600: '#3e3e60',
    700: '#2e2e48',
    800: '#1e1e30',
    900: '#141420',
  },
  // Semantic
  success: '#00ffab',
  danger: '#ff2d78',
  warning: '#ffb800',
  info: '#00d4ff',
  // Accent combos
  coral: '#ff6b6b',
  amber: '#ffbe0b',
  teal: '#2dd4bf',
  indigo: '#6366f1',
  violet: '#8b5cf6',
} as const;

// =============================================================================
// GRADIENT PRESETS — Spotify Wrapped inspired
// =============================================================================

export const gradients = {
  // Primary brand gradients
  primary: 'linear-gradient(135deg, #7b2ff7 0%, #00d4ff 50%, #39ff14 100%)',
  secondary: 'linear-gradient(135deg, #ff2d78 0%, #7b2ff7 50%, #00d4ff 100%)',
  accent: 'linear-gradient(135deg, #39ff14 0%, #00d4ff 100%)',

  // Spotify Wrapped-style vibrant gradients
  wrapped: 'linear-gradient(135deg, #7b2ff7 0%, #ff2d78 50%, #ffbe0b 100%)',
  hero: 'linear-gradient(180deg, #0a0a0f 0%, #1a0533 30%, #2d0a4e 60%, #0a0a0f 100%)',
  cardGlow: 'radial-gradient(ellipse at center, rgba(123, 47, 247, 0.15) 0%, transparent 70%)',

  // Mesh-style backgrounds
  meshDark: 'radial-gradient(at 20% 80%, rgba(123, 47, 247, 0.3) 0%, transparent 50%), radial-gradient(at 80% 20%, rgba(0, 212, 255, 0.2) 0%, transparent 50%), radial-gradient(at 50% 50%, rgba(255, 45, 120, 0.15) 0%, transparent 50%)',
  meshVibrant: 'radial-gradient(at 0% 100%, #7b2ff7 0%, transparent 50%), radial-gradient(at 100% 0%, #00d4ff 0%, transparent 50%), radial-gradient(at 50% 50%, #ff2d78 0%, transparent 50%)',

  // Gource visualization background
  gourceBackground: 'radial-gradient(ellipse at center, #0d0d1a 0%, #0a0a0f 100%)',

  // Button gradients
  buttonPrimary: 'linear-gradient(135deg, #7b2ff7 0%, #9333ea 100%)',
  buttonSecondary: 'linear-gradient(135deg, #00d4ff 0%, #3b82f6 100%)',
  buttonDanger: 'linear-gradient(135deg, #ff2d78 0%, #ec4899 100%)',
  buttonSuccess: 'linear-gradient(135deg, #39ff14 0%, #22c55e 100%)',

  // Text gradients (use with background-clip: text)
  textShimmer: 'linear-gradient(90deg, #c084fc 0%, #00d4ff 33%, #39ff14 66%, #ff2d78 100%)',
  textPrimary: 'linear-gradient(135deg, #c084fc 0%, #00d4ff 100%)',
  textAccent: 'linear-gradient(135deg, #39ff14 0%, #00d4ff 100%)',

  // Wrapped slide backgrounds
  wrappedSlides: {
    intro: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    'top-repos': 'linear-gradient(135deg, #0f3460 0%, #533483 50%, #7b2ff7 100%)',
    productivity: 'linear-gradient(135deg, #1b1b2f 0%, #162447 50%, #1a3a6b 100%)',
    'language-evolution': 'linear-gradient(135deg, #2d132c 0%, #801336 50%, #c72c41 100%)',
    streaks: 'linear-gradient(135deg, #1a1a2e 0%, #c72c41 50%, #e94560 100%)',
    'monthly-breakdown': 'linear-gradient(135deg, #0c0032 0%, #190061 50%, #240090 100%)',
    'yearly-comparison': 'linear-gradient(135deg, #240046 0%, #3c096c 50%, #5a189a 100%)',
    superlatives: 'linear-gradient(135deg, #10002b 0%, #5a189a 50%, #9d4edd 100%)',
    'final-summary': 'linear-gradient(135deg, #1a1a2e 0%, #7b2ff7 40%, #c084fc 100%)',
  } satisfies Record<WrappedSlideType, string>,
} as const;

// =============================================================================
// TYPOGRAPHY SCALE
// =============================================================================

export const typography: ThemeTypography = {
  fontFamily: {
    body: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    heading: '"Cal Sans", "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", Consolas, monospace',
  },
  fontSize: {
    // Pixel-precise type scale for game UI
    '2xs': '0.625rem',    // 10px
    xs: '0.75rem',         // 12px
    sm: '0.875rem',        // 14px
    base: '1rem',          // 16px
    lg: '1.125rem',        // 18px
    xl: '1.25rem',         // 20px
    '2xl': '1.5rem',       // 24px
    '3xl': '1.875rem',     // 30px
    '4xl': '2.25rem',      // 36px
    '5xl': '3rem',         // 48px
    '6xl': '3.75rem',      // 60px
    '7xl': '4.5rem',       // 72px
    '8xl': '6rem',         // 96px
    '9xl': '8rem',         // 128px
    // Score/counter display sizes
    score: '3.5rem',       // 56px — main score display
    combo: '2rem',         // 32px — combo counter
    stat: '2.5rem',        // 40px — stat cards
    hero: '5rem',          // 80px — hero headline
  },
  fontWeight: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  lineHeight: {
    none: '1',
    tight: '1.1',
    snug: '1.25',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
    // Display line-heights
    heading: '1.05',
    score: '1',
    body: '1.6',
  },
};

// =============================================================================
// ANIMATION TOKENS
// =============================================================================

export const animations: ThemeAnimations = {
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
    glacial: '1000ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    smooth: 'cubic-bezier(0.23, 1, 0.32, 1)',
    snap: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
};

// Extended animation presets for game UI
export const animationPresets = {
  // Slide transitions (Wrapped)
  slideUp: {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -30 },
    transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] },
  },
  slideLeft: {
    initial: { opacity: 0, x: 80 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
    transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  scalePop: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
  },
  // Counter animations
  countUp: {
    transition: { duration: 1.2, ease: [0.23, 1, 0.32, 1] },
  },
  // Glow pulse for interactive elements
  glowPulse: {
    animate: {
      boxShadow: [
        '0 0 20px rgba(123, 47, 247, 0.3)',
        '0 0 40px rgba(123, 47, 247, 0.6)',
        '0 0 20px rgba(123, 47, 247, 0.3)',
      ],
    },
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
  // Stagger children
  staggerContainer: {
    animate: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
  },
  staggerItem: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
  },
  // Shimmer effect for loading
  shimmer: {
    animate: { backgroundPosition: ['200% 0', '-200% 0'] },
    transition: { duration: 2.5, repeat: Infinity, ease: 'linear' },
  },
} as const;

// =============================================================================
// SPACING SYSTEM
// =============================================================================

export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',       // 4px
  1.5: '0.375rem',    // 6px
  2: '0.5rem',        // 8px
  2.5: '0.625rem',    // 10px
  3: '0.75rem',       // 12px
  3.5: '0.875rem',    // 14px
  4: '1rem',           // 16px
  5: '1.25rem',        // 20px
  6: '1.5rem',         // 24px
  7: '1.75rem',        // 28px
  8: '2rem',           // 32px
  9: '2.25rem',        // 36px
  10: '2.5rem',        // 40px
  11: '2.75rem',       // 44px
  12: '3rem',          // 48px
  14: '3.5rem',        // 56px
  16: '4rem',          // 64px
  20: '5rem',          // 80px
  24: '6rem',          // 96px
  28: '7rem',          // 112px
  32: '8rem',          // 128px
  36: '9rem',          // 144px
  40: '10rem',         // 160px
  44: '11rem',         // 176px
  48: '12rem',         // 192px
  52: '13rem',         // 208px
  56: '14rem',         // 224px
  60: '15rem',         // 240px
  64: '16rem',         // 256px
  72: '18rem',         // 288px
  80: '20rem',         // 320px
  96: '24rem',         // 384px
} as const;

// =============================================================================
// BORDER RADIUS
// =============================================================================

export const borderRadius = {
  none: '0',
  sm: '0.25rem',      // 4px
  DEFAULT: '0.5rem',  // 8px
  md: '0.625rem',     // 10px
  lg: '0.75rem',      // 12px
  xl: '1rem',          // 16px
  '2xl': '1.25rem',   // 20px
  '3xl': '1.5rem',    // 24px
  full: '9999px',
} as const;

// =============================================================================
// SHADOWS — dark-first with colored glows
// =============================================================================

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
  DEFAULT: '0 2px 4px -1px rgba(0, 0, 0, 0.5), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)',

  // Glow shadows
  glowPurple: '0 0 20px rgba(123, 47, 247, 0.4), 0 0 60px rgba(123, 47, 247, 0.2)',
  glowBlue: '0 0 20px rgba(0, 212, 255, 0.4), 0 0 60px rgba(0, 212, 255, 0.2)',
  glowGreen: '0 0 20px rgba(57, 255, 20, 0.4), 0 0 60px rgba(57, 255, 20, 0.2)',
  glowPink: '0 0 20px rgba(255, 45, 120, 0.4), 0 0 60px rgba(255, 45, 120, 0.2)',
  glowMulti: '0 0 20px rgba(123, 47, 247, 0.3), 0 0 40px rgba(0, 212, 255, 0.2), 0 0 60px rgba(255, 45, 120, 0.15)',

  // Card shadows
  card: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.05)',
  cardHover: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 40px rgba(123, 47, 247, 0.15)',
  cardActive: '0 2px 10px rgba(0, 0, 0, 0.3), 0 0 30px rgba(123, 47, 247, 0.25)',
} as const;

// =============================================================================
// Z-INDEX SCALE
// =============================================================================

export const zIndex = {
  behind: -1,
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
  overlay: 90,
  max: 100,
} as const;

// =============================================================================
// BREAKPOINTS
// =============================================================================

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// =============================================================================
// CSS CUSTOM PROPERTIES MAP
// These map to shadcn/ui conventions using oklch format
// =============================================================================

export const cssVariables = {
  light: {
    '--background': '0 0% 100%',
    '--foreground': '260 20% 10%',
    '--card': '260 10% 97%',
    '--card-foreground': '260 20% 10%',
    '--popover': '260 10% 97%',
    '--popover-foreground': '260 20% 10%',
    '--primary': '271 81% 56%',          // #7b2ff7
    '--primary-foreground': '0 0% 100%',
    '--secondary': '190 100% 50%',       // #00d4ff
    '--secondary-foreground': '260 20% 10%',
    '--muted': '260 10% 92%',
    '--muted-foreground': '260 10% 45%',
    '--accent': '110 100% 54%',          // #39ff14
    '--accent-foreground': '260 20% 10%',
    '--destructive': '340 100% 59%',     // #ff2d78
    '--destructive-foreground': '0 0% 100%',
    '--border': '260 10% 88%',
    '--input': '260 10% 88%',
    '--ring': '271 81% 56%',
    '--radius': '0.625rem',
    '--chart-1': '271 81% 56%',
    '--chart-2': '190 100% 50%',
    '--chart-3': '110 100% 54%',
    '--chart-4': '340 100% 59%',
    '--chart-5': '43 100% 50%',
  },
  dark: {
    '--background': '240 20% 4%',       // #0a0a0f
    '--foreground': '260 10% 94%',
    '--card': '240 18% 7%',             // slightly lighter
    '--card-foreground': '260 10% 94%',
    '--popover': '240 18% 7%',
    '--popover-foreground': '260 10% 94%',
    '--primary': '271 91% 56%',          // #7b2ff7
    '--primary-foreground': '0 0% 100%',
    '--secondary': '190 100% 50%',       // #00d4ff
    '--secondary-foreground': '0 0% 100%',
    '--muted': '240 12% 14%',
    '--muted-foreground': '260 10% 60%',
    '--accent': '110 100% 54%',          // #39ff14
    '--accent-foreground': '240 20% 4%',
    '--destructive': '340 100% 59%',     // #ff2d78
    '--destructive-foreground': '0 0% 100%',
    '--border': '240 12% 16%',
    '--input': '240 12% 16%',
    '--ring': '271 91% 56%',
    '--radius': '0.625rem',
    '--chart-1': '271 91% 65%',
    '--chart-2': '190 100% 55%',
    '--chart-3': '110 100% 58%',
    '--chart-4': '340 100% 63%',
    '--chart-5': '43 100% 55%',
    // Gitted-specific custom properties
    '--gitted-purple': '271 91% 56%',
    '--gitted-blue': '190 100% 50%',
    '--gitted-green': '110 100% 54%',
    '--gitted-pink': '340 100% 59%',
    '--gitted-amber': '43 100% 50%',
    '--gitted-surface': '240 18% 7%',
    '--gitted-surface-raised': '240 16% 10%',
    '--gitted-surface-overlay': '240 14% 13%',
    '--gitted-border-subtle': '240 12% 14%',
    '--gitted-border-default': '240 12% 18%',
    '--gitted-border-strong': '240 12% 24%',
    // Gource-specific
    '--gource-node': '217 91% 68%',       // #60a5fa
    '--gource-edge': '240 10% 30%',
    '--gource-beam': '271 91% 65%',
    '--gource-particle': '190 100% 55%',
    '--gource-bg': '240 25% 5%',
    // Score/game display
    '--score-glow': '110 100% 54%',
    '--combo-glow': '271 91% 65%',
    '--streak-glow': '340 100% 59%',
  },
} as const;

// =============================================================================
// GOURCE NODE COLORS BY FILE CATEGORY
// =============================================================================

export const gourceNodeColors = {
  code: '#60a5fa',
  markup: '#f97316',
  config: '#a78bfa',
  documentation: '#34d399',
  asset: '#fb923c',
  test: '#fbbf24',
  build: '#f472b6',
  data: '#2dd4bf',
  other: '#94a3b8',
} as const;

// =============================================================================
// WRAPPED SLIDE GRADIENT PRESETS (mapped from WrappedSlideType)
// =============================================================================

export const wrappedSlideGradients: Record<WrappedSlideType, { colors: string[]; css: string }> = {
  intro: {
    colors: ['#1a1a2e', '#16213e', '#0f3460'],
    css: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  'top-repos': {
    colors: ['#0f3460', '#533483', '#7b2ff7'],
    css: 'linear-gradient(135deg, #0f3460 0%, #533483 50%, #7b2ff7 100%)',
  },
  productivity: {
    colors: ['#1b1b2f', '#162447', '#1a3a6b'],
    css: 'linear-gradient(135deg, #1b1b2f 0%, #162447 50%, #1a3a6b 100%)',
  },
  'language-evolution': {
    colors: ['#2d132c', '#801336', '#c72c41'],
    css: 'linear-gradient(135deg, #2d132c 0%, #801336 50%, #c72c41 100%)',
  },
  streaks: {
    colors: ['#1a1a2e', '#c72c41', '#e94560'],
    css: 'linear-gradient(135deg, #1a1a2e 0%, #c72c41 50%, #e94560 100%)',
  },
  'monthly-breakdown': {
    colors: ['#0c0032', '#190061', '#240090'],
    css: 'linear-gradient(135deg, #0c0032 0%, #190061 50%, #240090 100%)',
  },
  'yearly-comparison': {
    colors: ['#240046', '#3c096c', '#5a189a'],
    css: 'linear-gradient(135deg, #240046 0%, #3c096c 50%, #5a189a 100%)',
  },
  superlatives: {
    colors: ['#10002b', '#5a189a', '#9d4edd'],
    css: 'linear-gradient(135deg, #10002b 0%, #5a189a 50%, #9d4edd 100%)',
  },
  'final-summary': {
    colors: ['#1a1a2e', '#7b2ff7', '#c084fc'],
    css: 'linear-gradient(135deg, #1a1a2e 0%, #7b2ff7 40%, #c084fc 100%)',
  },
};

// =============================================================================
// COMPOSITE THEME CONFIG
// =============================================================================

export const themeColors: ThemeColors = {
  primary: colors.purple[700],
  secondary: colors.blue.electric,
  accent: colors.green.neon,
  background: {
    primary: colors.dark[500],    // #0a0a0f
    secondary: colors.dark[200],  // #14141f
    tertiary: colors.dark[50],    // #1e1e2e
  },
  text: {
    primary: colors.neutral[50],   // #f8f8fc
    secondary: colors.neutral[300], // #a8a8c8
    muted: colors.neutral[400],     // #7c7ca0
  },
  success: colors.success,
  danger: colors.danger,
  warning: colors.warning,
  info: colors.info,
  gource: {
    nodeDefault: gourceNodeColors.code,
    edgeDefault: colors.neutral[700],
    beamDefault: colors.purple[500],
    particleDefault: colors.blue.electric,
  },
};

export const themeGradients: ThemeGradients = {
  primary: gradients.primary,
  secondary: gradients.secondary,
  wrapped: gradients.wrapped,
  hero: gradients.hero,
  cardGlow: gradients.cardGlow,
  wrappedSlides: gradients.wrappedSlides,
};

export const themeConfig: ThemeConfig = {
  colors: themeColors,
  gradients: themeGradients,
  animations,
  typography,
};

// =============================================================================
// UTILITY HELPERS
// =============================================================================

/**
 * Get a neon glow box-shadow CSS value for a given hex color
 */
export function neonGlow(hexColor: string, intensity: 'low' | 'medium' | 'high' = 'medium'): string {
  const alphaMap = { low: [0.2, 0.1], medium: [0.4, 0.2], high: [0.6, 0.35] };
  const sizeMap = { low: [15, 40], medium: [20, 60], high: [30, 80] };
  const [a1, a2] = alphaMap[intensity];
  const [s1, s2] = sizeMap[intensity];

  // Convert hex to rgba
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  return `0 0 ${s1}px rgba(${r}, ${g}, ${b}, ${a1}), 0 0 ${s2}px rgba(${r}, ${g}, ${b}, ${a2})`;
}

/**
 * Get the gradient CSS for a wrapped slide type
 */
export function getWrappedSlideGradient(slideType: WrappedSlideType): string {
  return wrappedSlideGradients[slideType]?.css ?? wrappedSlideGradients.intro.css;
}

/**
 * Get a contrasting text color (white or dark) for a given background hex
 */
export function getContrastText(hexBg: string): string {
  const r = parseInt(hexBg.slice(1, 3), 16);
  const g = parseInt(hexBg.slice(3, 5), 16);
  const b = parseInt(hexBg.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? colors.dark[500] : colors.neutral[50];
}

/**
 * Generate a vibrant color for a contributor based on their ID
 */
export function getContributorColor(contributorId: string): string {
  const palette = [
    colors.purple[400],
    colors.blue.electric,
    colors.green.neon,
    colors.pink.hot,
    colors.amber,
    colors.teal,
    colors.indigo,
    colors.coral,
    colors.violet,
    colors.green.mint,
    colors.pink.magenta,
    colors.blue.neon,
  ];

  let hash = 0;
  for (let i = 0; i < contributorId.length; i++) {
    const char = contributorId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }

  return palette[Math.abs(hash) % palette.length];
}

/**
 * Build CSS custom properties string for inline styles
 */
export function buildCSSVariables(mode: 'light' | 'dark' = 'dark'): Record<string, string> {
  return cssVariables[mode];
}

/**
 * Get the transition CSS shorthand for a given animation speed
 */
export function transition(
  property: string = 'all',
  speed: keyof ThemeAnimations['duration'] = 'normal',
  easing: keyof ThemeAnimations['easing'] = 'default'
): string {
  return `${property} ${animations.duration[speed]} ${animations.easing[easing]}`;
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default themeConfig;
