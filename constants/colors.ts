/**
 * KingBet67 Design System — Colors
 * Extracted from stitch/ HTML mockups
 */

export const Colors = {
  // Backgrounds
  darkBg: '#0b1120',
  cardBg: '#161f32',
  navBg: '#0f172a',
  surfaceDark: '#1e293b',

  // Primary accent
  neonGreen: '#adff2f',
  neonGreenDim: 'rgba(173, 255, 47, 0.3)',
  neonGreenBg: 'rgba(173, 255, 47, 0.1)',
  neonGreenBorder: 'rgba(173, 255, 47, 0.5)',

  // Status colors
  errorRed: '#f87171',
  errorRedBg: 'rgba(248, 113, 113, 0.2)',
  pendingYellow: '#fbbf24',
  pendingYellowBg: 'rgba(251, 191, 36, 0.2)',
  liveRed: '#ef4444',
  successGreen: '#22c55e',
  successGreenBg: 'rgba(34, 197, 94, 0.1)',

  // Text
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  textDark: '#1e293b',

  // Borders
  border: '#334155',
  borderLight: 'rgba(255, 255, 255, 0.1)',
  borderDark: 'rgba(148, 163, 184, 0.2)',

  // Misc
  black: '#000000',
  white: '#ffffff',
  transparent: 'transparent',

  // Rank colors (Leaderboard)
  gold: '#fbbf24',
  silver: '#94a3b8',
  bronze: '#d97706',
  blueAccent: '#3b82f6',
};

// Shadow presets (React Native compatible)
export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  neonGlow: {
    shadowColor: Colors.neonGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  bottomNav: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
};
