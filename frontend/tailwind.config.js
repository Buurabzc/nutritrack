/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#090D0B",
        "surface-1": "#111812",
        "surface-2": "#182018",
        "surface-3": "#1E2A1F",
        lime: "#C8F076",
        "lime-dim": "#8FB84D",
        text: "#EEE9DC",
        "text-2": "#8A9488",
        "text-3": "#4A5449",
        red: "#C96B4A",
        blue: "#5B9FE0",
        purple: "#9B82D8",
        amber: "#D4A843",
      },
      fontFamily: {
        serif: ["DM Serif Display", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        md: "9px",
        lg: "12px",
        pill: "99px",
      },
    },
  },
  plugins: [],
}
