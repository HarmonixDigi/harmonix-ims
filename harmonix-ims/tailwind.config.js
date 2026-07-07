/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#185D6D',
          light: '#e8f2f4',
          mid: '#2a7a8e',
        },
        orange: {
          DEFAULT: '#FF9810',
          light: '#fff4e6',
        },
        bg: '#F4F6F8',
      },
    },
  },
  plugins: [],
}
