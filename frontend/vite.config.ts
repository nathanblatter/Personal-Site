import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['motion/react'],
          'vendor-lucide': ['lucide-react'],
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'remark-frontmatter', 'remark-emoji', 'rehype-raw'],
          // katex / rehype-katex / remark-math / mermaid are NOT listed here on purpose:
          // BlogPost and Mermaid pull them in with dynamic import(), so Rollup emits
          // them as their own lazy chunks that only load for posts that need them.
          'vendor-recharts': ['recharts'],
        },
      },
    },
  },
})
