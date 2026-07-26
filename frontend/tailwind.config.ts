import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#1f2522",
        mist: "#f7f3ec",
        oat: "#eee5d8",
        fern: "#8B5CF6",
        coral: "#d96f5d",
        sky: "#dcecf3"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(139, 92, 246, 0.18)"
      }
    }
  },
  plugins: []
} satisfies Config;
