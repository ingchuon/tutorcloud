/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#E8F5EE',
          100: '#C8E6D4',
          200: '#A5D4B8',
          300: '#7DC09A',
          400: '#5AAD82',
          500: '#1C3A2A',
          600: '#173124',
          700: '#122618',
          800: '#0D1C12',
          900: '#08120B',
        },
        accent: {
          50:  '#FEF9EC',
          100: '#FDF0C8',
          200: '#FBE49E',
          300: '#F8D572',
          400: '#F5C84E',
          500: '#E8A020',
          600: '#D4891A',
          700: '#B57015',
          800: '#8F560F',
          900: '#6A3E0A',
        },
        cream: {
          50:  '#FDFAF5',
          100: '#F5F0E8',
          200: '#EAE0D0',
          500: '#D4C4A8',
          600: '#BDA882',
          700: '#A08C62',
        },
        surface: '#F5F0E8',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
