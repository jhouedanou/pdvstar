/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // App Palette defined in Architecture
        primary: '#FFD700', // Gold/Beer
        secondary: '#FF4500', // Neon Orange
        dark: '#121212',
        'dark-lighter': '#1E1E1E',
        surface: '#2C2C2C',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 4s linear infinite',
        'marquee': 'marquee 10s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        }
      },
      spacing: {
        'safe': 'env(safe-area-inset-bottom)',
      }
    },
  },
  plugins: [],
}
