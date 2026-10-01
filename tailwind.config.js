/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/templates/**/*.ts',
    './src/routes/**/*.ts',
    './src/services/**/*.ts',
    './src/utils/**/*.ts',
    './src/constants/**/*.ts',
    './src/index.ts',
    // The inline client script lives here and toggles classes at runtime.
    './scripts/build-assets.ts',
  ],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#fef3ec', 100: '#fde4d4', 200: '#f9c5a8', 300: '#f5a071', 400: '#f07a3a', 500: '#ec6517', 600: '#dd4c0e', 700: '#b7370f', 800: '#922e14', 900: '#782814' },
        // Tailwind's `stone` scale. 300-700 were missing, which silently made
        // ~330 text-surface-*/border-surface-* classes no-ops.
        // 400/500 are darkened off-stone: they are text-only shades here, and
        // stone-400 on white was 2.5:1 — too faint for the text-xs job meta.
        surface: { 50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1', 400: '#827b76', 500: '#6b645f', 600: '#57534e', 700: '#44403c', 800: '#292524', 900: '#1c1917' },
      },
    },
  },
};
