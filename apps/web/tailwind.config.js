/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefdf4',
          100: '#d7fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        wa: {
          'teal-primary': '#00a884',
          'teal-dark': '#008069',
          'header-bg': '#f0f2f5',
          'chat-bg': '#efeae2',
          'bubble-in': '#ffffff',
          'bubble-out': '#d9fdd3',
          'note-card-bg': '#fef3c7',
          'tick-blue': '#53bdeb',
          'badge-unread': '#25d366',
          'panel-bg': '#ffffff',
          'text-primary': '#111b21',
          'text-secondary': '#667781',
          border: '#e9edef',
        },
      },
    },
  },
  plugins: [],
}
