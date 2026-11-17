import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Relative assets work both at /studyroom-demo/ on Pages and in local preview.
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: { outDir: 'docs', emptyOutDir: true }
})
