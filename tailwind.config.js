/** @type {import('tailwindcss').Config} */
export default {
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
    },
  },
  plugins: [],
}
