import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

/** Tailwind規定のgreenをprimaryとして使用（グラフダウンロードボタンと同じ緑） */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: colors.green,
      },
    },
  },
  plugins: [],
};

export default config;
