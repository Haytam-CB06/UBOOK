import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "hsl(var(--canvas) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-2": "hsl(var(--surface-2) / <alpha-value>)",
        "surface-3": "hsl(var(--surface-3) / <alpha-value>)",
        ink: "hsl(var(--ink) / <alpha-value>)",
        "ink-soft": "hsl(var(--ink-soft) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        line: "hsl(var(--line) / <alpha-value>)",
        primary: "hsl(var(--primary) / <alpha-value>)",
        "primary-ink": "hsl(var(--primary-ink) / <alpha-value>)",
        secondary: "hsl(var(--secondary) / <alpha-value>)",
        "secondary-ink": "hsl(var(--secondary-ink) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        error: "hsl(var(--error) / <alpha-value>)",
        neutral: {
          50: "#F8F7F4",
          100: "#EEEAE3",
          200: "#DED6C9",
          300: "#C5B9AA",
          400: "#998C7E",
          500: "#766A5E",
          600: "#5C5147",
          700: "#413934",
          800: "#292522",
          900: "#171513"
        },
        brand: {
          50: "hsl(var(--primary) / 0.08)",
          100: "hsl(var(--primary) / 0.14)",
          200: "hsl(var(--primary) / 0.24)",
          300: "hsl(var(--primary) / 0.34)",
          400: "hsl(var(--primary) / 0.64)",
          500: "hsl(var(--primary) / 0.84)",
          600: "hsl(var(--primary))",
          700: "hsl(var(--primary) / 0.92)",
          800: "hsl(var(--secondary))",
          900: "hsl(var(--ink))"
        },
        sand: "hsl(var(--canvas) / <alpha-value>)",
        border: "hsl(var(--line) / <alpha-value>)",
        danger: "hsl(var(--error) / <alpha-value>)"
      },
      fontFamily: {
        sans: [
          "Aptos",
          "SF Pro Display",
          "Segoe UI Variable Display",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ],
        display: [
          "Aptos Display",
          "SF Pro Display",
          "Segoe UI Variable Display",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ]
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)"
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        lift: "var(--shadow-lift)",
        float: "var(--shadow-lift)"
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.22, 1, 0.36, 1)"
      },
      backgroundImage: {
        "hero-wash":
          "linear-gradient(90deg, rgb(20 17 14 / 0.82) 0%, rgb(20 17 14 / 0.48) 54%, rgb(20 17 14 / 0.14) 100%)"
      }
    }
  },
  plugins: []
};

export default config;
