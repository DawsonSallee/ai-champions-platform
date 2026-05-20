import type { Config } from "tailwindcss";

export default {
  content: ["./apps/web/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand — modern indigo, less corporate than the previous navy.
        brand: {
          DEFAULT: "#4f46e5", // indigo-600
          hover: "#4338ca",
          fg: "#ffffff",
          subtle: "#eef2ff",
          ring: "#c7d2fe",
        },
        // Refined neutral palette — closer to Linear/Vercel than default gray.
        ink: {
          DEFAULT: "#0a0a0a",
          muted: "#525252",
          subtle: "#737373",
          soft: "#a3a3a3",
        },
        surface: {
          // Pure-white cards on a barely-off-white page.
          DEFAULT: "#ffffff",
          page: "#fafafa",
          subtle: "#f5f5f5",
          border: "#e5e5e5",
          divider: "#ededed",
        },
        // Status colors used inside badges — softer, smaller saturation.
        ok: { DEFAULT: "#059669", subtle: "#ecfdf5", ring: "#a7f3d0" },
        warn: { DEFAULT: "#d97706", subtle: "#fffbeb", ring: "#fde68a" },
        bad: { DEFAULT: "#dc2626", subtle: "#fef2f2", ring: "#fecaca" },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      fontSize: {
        // Slightly tighter than defaults for an Inter-on-screen look.
        xs: ["0.75rem", { lineHeight: "1.1rem", letterSpacing: "0" }],
        sm: ["0.875rem", { lineHeight: "1.35rem", letterSpacing: "0" }],
        base: ["0.9375rem", { lineHeight: "1.5rem", letterSpacing: "-0.005em" }],
        lg: ["1.0625rem", { lineHeight: "1.6rem", letterSpacing: "-0.01em" }],
        xl: ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.015em" }],
        "2xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.02em" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.025em" }],
      },
      borderRadius: {
        sm: "0.375rem",
        DEFAULT: "0.5rem",
        md: "0.625rem",
        lg: "0.75rem",
        xl: "1rem",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(10, 10, 10, 0.04)",
        sm: "0 1px 2px 0 rgba(10, 10, 10, 0.04), 0 1px 3px 0 rgba(10, 10, 10, 0.03)",
        md: "0 4px 6px -1px rgba(10, 10, 10, 0.05), 0 2px 4px -2px rgba(10, 10, 10, 0.04)",
        lift: "0 12px 24px -8px rgba(10, 10, 10, 0.08), 0 4px 6px -2px rgba(10, 10, 10, 0.04)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
      },
    },
  },
} satisfies Config;
