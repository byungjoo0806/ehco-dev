import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "key-color" : "#d10041",
        'key-color-dark': '#f87171',
      },
    },
  },
  plugins: [
    // require('@tailwindcss/forms'),
  ],
} satisfies Config;
