/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mythical Void brand colors
        'mythic-gold': '#FFD54F',
        'mythic-purple': '#7B1FA2',
        'mythic-space': '#1A1A2E',
        'mythic-void': '#0F0F1E',
        'cosmic-blue': '#4A90E2',
        'cosmic-teal': '#00CED1',
        'stellar-white': '#F8F8FF',
      },
      fontFamily: {
        'sans': ['Poppins', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backdropBlur: {
        'xs': '2px',
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
