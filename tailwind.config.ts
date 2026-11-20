import { heroui, HeroUIPluginConfig } from "@heroui/react";
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        'custom-md': 'rgb(0 0 0 / 35%) 0px 0px 20px 0px',
      },
      zIndex: {
        '-1': '-1',
      },
      scale: {
        '100.5': '1.005',
        '101': '1.01',
        '102.5': '1.025',
      },
      screens: {
        '2xl': { 'min': '1535px' },
        'xl': { 'min': '1279px' },
        'lg': { 'max': '1279px' },
        'md': { 'max': '767px' },
        'xs': { 'max': '639px' },
      },
      aspectRatio: {
        '3/2': '3/2',
        '2/3': '2/3',
        '2/5': '2/5',
        '4/3': '4/3',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'pointed': 'radial-gradient(#ffffff33 1px, #00001010 1px)',
      },
      gridTemplateColumns: {
        'sm-card': 'repeat(auto-fill,minmax(130px,1fr))',
        'md-card': 'repeat(auto-fill,minmax(170px,1fr))',
        'bg-card': 'repeat(auto-fill,minmax(210px,1fr))',
        'sidebar': '90px auto',
      },
      gridTemplateRows: {
        'sm-card': 'repeat(auto-fill,minmax(130px,1fr))',
        'md-card': 'repeat(auto-fill,minmax(170px,1fr))',
        'bg-card': 'repeat(auto-fill,minmax(210px,1fr))',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s',
        'fade-out': 'fadeOut 0.25s',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      addCommonColors: true,
      themes: {
        dark: {
          colors: {
            background: "#151515",
            accented: "#2f2f2f",
            pure: { opposite: "#fff", theme: '#000' }, //opposite of theme, i.e for dark is pure white and vicevirsa
          }
        },
        light: {
          colors: {
            background: '#e7e7e7',
            // objects (not plain strings): heroui deep-merges them with its base palette, a string would
            // replace the whole scale and leave foreground-50..900 / default-50..900 / default-foreground undefined
            foreground: { DEFAULT: '#151515' },
            accented: "#f7f7f7",
            default: { DEFAULT: '#fff' },
            pure: { opposite: "#000", theme: '#fff' }, //opposite of theme, i.e for light is pure black and vicevirsa
          }
        },
      }
    } as HeroUIPluginConfig)
  ],
};
export default config;
