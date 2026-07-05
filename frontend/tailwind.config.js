/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          500: "#3b6dff",
          600: "#2d57e0",
          700: "#1f43b8",
        },
      },
    },
  },
  plugins: [],
};
