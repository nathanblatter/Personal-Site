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
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'remark-frontmatter', 'remark-emoji', 'remark-math', 'rehype-raw'],
          'vendor-katex': ['katex', 'rehype-katex'],
          'vendor-recharts': ['recharts'],
        },
      },
    },
  },
})
