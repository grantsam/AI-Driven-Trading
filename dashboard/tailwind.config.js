/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'binance-bg': '#0b0e11',
        'binance-panel': '#181a20',
        'binance-border': '#2b3139',
        'binance-green': '#0ecb81',
        'binance-red': '#f6465d',
        'binance-gray': '#848e9c',
      },
      fontFamily: {
        mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
        sans: ['Inter', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
