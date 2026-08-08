/** @type {import('tailwindcss').Config} */
//
// The design tokens from the restructure handoff (README → "Design tokens").
// Ink is the chrome. A profile's hue is IDENTITY ONLY — a dot, an avatar, a
// card edge — and never paints a rail, a tab or a button. That rule is the
// whole reason eight profiles stopped reading as eight different apps.
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#1c1a21',
        text: '#17151a',
        paper: '#faf8f6',
        surface: '#ffffff',
        sunken: '#f6f3f0',
        'sunken-muted': '#f1eeeb',
        chip: '#efece9',
        control: '#f4f1ee',
        muted: '#6b6570',
        faint: '#9b95a1',
        accent: '#ea4711',
        'accent-text': '#b8551f',
        overdue: '#c2410c',
        positive: '#1a7f4b',
        'positive-bg': '#e6f5ec',
        // Kept: the pre-restructure aliases legacy screens still reference.
        'accent-light': '#fff3ef',
        'accent-mid': '#fcd9ce',
      },
      borderColor: {
        hairline: 'rgba(23,21,26,.09)',
        divider: 'rgba(23,21,26,.07)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,21,26,.04)',
        seed: '0 2px 10px rgba(234,71,17,.10)',
        panel: '-16px 0 40px rgba(23,21,26,.22)',
        drawer: '16px 0 40px rgba(23,21,26,.3)',
      },
      borderRadius: {
        card: '18px',
        frame: '20px',
      },
    },
  },
  plugins: [],
};
