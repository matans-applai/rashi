/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Heebo",
          "Rubik",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dae6ff",
          200: "#bcd0ff",
          300: "#94b1fb",
          400: "#6a8df8",
          500: "#3b6cf6",
          600: "#2a55d4",
          700: "#1f43ad",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)",
        cardHover:
          "0 10px 25px -10px rgba(16,24,40,.15), 0 2px 6px rgba(16,24,40,.05)",
      },
    },
  },
  plugins: [],
};
