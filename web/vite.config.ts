import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Prefer authored TypeScript over legacy sibling JavaScript emitted by older builds.
    extensions: ['.mjs', '.ts', '.tsx', '.js', '.jsx', '.json']
  }
})
