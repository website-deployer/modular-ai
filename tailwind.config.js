/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans"', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Noto Sans"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
