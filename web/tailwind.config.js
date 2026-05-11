/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          950: '#0a0e1a',
          900: '#111827',
          850: '#1a2236',
          800: '#1f2937',
          700: '#374151',
        },
      },
    },
  },
  plugins: [],
}
