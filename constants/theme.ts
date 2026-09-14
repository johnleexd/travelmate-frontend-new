import 'styled-components';

/** Legacy styled-components tokens retained for compatibility. */
export const theme = {
  colors: {
    primary: '#1A73E8', // Light Blue / Blue
    primaryHover: '#1557B0',
    primaryLight: '#E8F0FE',
    secondary: '#F35C3E', // Coral/Orange from Get Started button
    secondaryHover: '#D94D31',
    text: '#1E293B',
    textLight: '#64748B',
    white: '#FFFFFF',
    whiteMuted: 'rgba(255, 255, 255, 0.85)',
    blueMuted: 'rgba(74, 211, 255, 0.2)',
    glassBg: 'rgba(255, 255, 255, 0.15)',
    glassBorder: 'rgba(255, 255, 255, 0.25)',
    glassText: '#000000',
    glassTextMuted: '#475569',
    skyBlue: '#4AD3FF', // From Perfect Trip text
  },
  fonts: {
    main: 'var(--font-sans), Inter, system-ui, -apple-system, sans-serif',
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    xxl: '1.5rem',
    title: '3rem',
    titleMobile: '2rem',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '20px',
    xxl: '30px',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    glass: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
  }
};

export type ThemeType = typeof theme;

declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends ThemeType {}
}

