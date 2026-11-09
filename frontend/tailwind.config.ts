import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', "system-ui", "sans-serif"],
        display: ['"Fraunces"', '"Atkinson Hyperlegible"', "Georgia", "serif"],
      },
      colors: {
        surface: "var(--color-surface)",
        ink: "var(--color-ink)",
        accent: "var(--color-accent)",
        muted: "var(--color-muted)",
      },
    },
  },
  plugins: [],
};

export default config;
