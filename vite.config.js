import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import localizeJsx from './scripts/localize-jsx.js'
import { transformAsync } from '@babel/core'
import { buildKnowledge } from './src/ai-knowledge.js'

export default defineConfig({
  plugins: [{
    name: 'logos-localize-jsx',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.split('?')[0].endsWith('.jsx') || id.includes('node_modules')) return
      return transformAsync(code, {
        filename: id.split('?')[0], configFile: false, babelrc: false,
        parserOpts: { plugins: ['jsx'] }, plugins: [localizeJsx], sourceMaps: true,
      })
    },
  }, {
    // База знаний ИИ-агента рядом с public/api/ai-chat.php (см. deploy/ai-agent.md).
    name: 'logos-ai-knowledge',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'api/ai-knowledge.txt', source: buildKnowledge() })
    },
  }, react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    // Чат в режиме разработки: npm run build && php -S localhost:8787 -t dist
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
})
