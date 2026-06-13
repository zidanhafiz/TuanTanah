import type { Config } from 'tailwindcss'

/**
 * Tuan Tanah design system — light "paper" neobrutalism.
 *
 * Semantic tokens live here so components reference intent (surface/accent/ink)
 * instead of raw palette steps. The signature look = flat bright fills + thick
 * `ink` borders + hard offset shadows (no blur) + a press interaction.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Archivo Black"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Surfaces
        paper: '#FBF3E2', // warm cream — the page background
        surface: '#FFFFFF', // cards / panels
        'surface-sunken': '#F4EAD2', // insets, wells, muted tiles
        // Ink (borders + text). The black is the load-bearing brutalist element.
        ink: '#1A1714',
        'ink-muted': '#6B6256',
        'ink-faint': '#9A8F7D',
        // Accents — bright, saturated, readable on paper with an ink border.
        accent: { DEFAULT: '#FBBF24', strong: '#F59E0B', soft: '#FDE9B8' },
        info: { DEFAULT: '#4DABF7', strong: '#1C7ED6', soft: '#D5E9FB' },
        danger: { DEFAULT: '#FF6B6B', strong: '#E03131', soft: '#FFE0E0' },
        success: { DEFAULT: '#51CF66', strong: '#2F9E44', soft: '#D8F3DD' },
      },
      borderColor: {
        DEFAULT: '#1A1714',
      },
      boxShadow: {
        // Hard offset shadows — no blur, no spread. The brutalist signature.
        'brutal-xs': '1.5px 1.5px 0 0 #1A1714',
        'brutal-sm': '2px 2px 0 0 #1A1714',
        brutal: '4px 4px 0 0 #1A1714',
        'brutal-lg': '6px 6px 0 0 #1A1714',
        'brutal-xl': '8px 8px 0 0 #1A1714',
      },
      transitionTimingFunction: {
        // Slight overshoot — gives chunky elements a tactile "snap".
        snap: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      zIndex: {
        board: '0',
        panel: '10',
        toast: '40',
        modal: '50',
        tooltip: '60',
      },
    },
  },
  plugins: [],
} satisfies Config
